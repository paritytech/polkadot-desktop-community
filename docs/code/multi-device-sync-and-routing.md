# Multi-Device Sync & P2P Chat Routing — iOS · Android · Desktop

> Status: **analysis / gap report only — no code changes.** Branches captured: Desktop
> `feat/multidevice-vendored`, Android `mds-integration`, iOS `feature/device-sync-recovery`,
> SDK `feat/sso-spec-v0.2.2`. Every claim is anchored to `path:line` so it can be re-verified
> as the code moves.

This document answers two questions:

1. **Routing** — when device *X* wants to send a chat message to peer *B*, how does it
   know *which* accounts to address the envelope to?
2. **Sync (MDS)** — when device *X* establishes/changes a chat, how does its **sibling**
   device *X'* (same user, paired) learn about it, in both directions?

It then analyses the gaps, with **Desktop as the main suspect**, and describes the fix that
would be needed to interop with the **current** Android implementation. The fix is a
**recommendation**, not implemented here.

---

## 0. Vocabulary — the keys (this is the whole ballgame)

There are two identity tiers and two key purposes. Conflating them is the source of
almost every bug here.

| Key | Tier | Purpose | Who holds it |
|-----|------|---------|--------------|
| **identity sr25519** (`accountId`) | user | On-chain identity; the SS58 a contact is keyed by. Trust root for device-roster events. | one per user, shared across all the user's devices |
| **identity chat key** (`identityChatPrivateKey` / `identityChatPublicKey`, P-256) | user | Outer ECDH for the *identity channel* (chat-requests, accept signals, roster fan-out). Derives the push topic. | one per user; **private half shared to every sibling via the V2 handshake** |
| **statement account** (`statementAccountId`, sr25519) | device | Unique per-device id. Signs statements; addresses the per-device envelope slot. | one per physical device |
| **device encryption key** (`encryptionPublicKey`, P-256, 65 bytes) | device | Per-device ECDH wrap of the one-shot message key inside a `MultiDeviceRequest`. | one per physical device |

Two **rosters** built from those keys:

- **OWN / sibling roster** — *my* other paired devices `{statementAccountId, encryptionPublicKey}`.
  Source of truth differs per platform (SSO sessions on mobile; `device-sync` table on Desktop).
  Used to spawn sync channels and to fan out *my* devices to a peer.
- **PEER roster** — *the other party's* devices `{statementAccountId, encryptionPublicKey}`.
  **This is what routing reads.** Built from `DeviceAdded` / `DeviceChatAccepted` events.

Evidence:
- Desktop: `domains/device/identity/types.ts:18-23` (device), `:74-85` (user incl. `identityChatPrivateKey`); `domains/contact/identity/types.ts:8-11` (peer `Device`), `:22-27` (`Contact` incl. `devices[]`); `domains/device-sync/types.ts:8-14` (`KnownUserDevice`, own roster).
- Android: `feature/sso/api/.../ActiveSsoSession.kt:6-18` (own device); `ContactDevice` + `ContactDevicesRepository` (peer roster, a **separate table**); `IdentityProof.kt:6-9`.
- iOS: `Chat/Model/LocalDevice.swift:6-11` (own); `ChatContact.swift:12-15` (peer `PeerDevice`); `MultiDeviceAwareStatementDataCoder.swift:17-18`.

---

## 1. Routing — "where do I send?"

All three platforms send **one** envelope on the peer's **identity channel** (topic derived
from `K(ourDeviceEncPriv, peerIdentityChatPub)`), and inside it wrap the one-shot AES key
**once per peer device** (`MultiDeviceRequest`, tag 2). The receiver picks the slot keyed by
*its own* `statementAccountId` and unwraps.

```
sender                                   peer (user B, 2 devices)
  message ──AES(K_msg)──┐
                        │   devicesInfo = [
                        │     { B_dev1.stmtAcct, ECDH(myDevEncPriv, B_dev1.encPub)(K_msg) },
  K(myDevEncPriv, ─────►│     { B_dev2.stmtAcct, ECDH(myDevEncPriv, B_dev2.encPub)(K_msg) },
   B_identityChatPub)   │   ]
   = outer topic+enc    └─► one statement on SessionId(A,B)  ─────► B_dev1 unwraps slot[0]
                                                                    B_dev2 unwraps slot[1]
```

**The recipient list = the PEER roster.** No peer roster ⇒ no slots ⇒ nothing to send.

| Platform | Recipient list source | Empty-roster behaviour |
|---|---|---|
| Desktop | `Contact.devices` → `chatSessionV2.encryptForRecipients` | **throws** `cannot send: peer device roster is empty` (`chatSessionV2.ts:167-168`); `startSession` also gates on it (`managerV2Factory.ts:858`) |
| Android | `ContactDevicesRepository.subscribeDevices` → `MultiDeviceOutgoingBodyBuilder.currentRecipients` (`:61-69`) | builds an empty recipient set |
| iOS | `Contact.devices` → `PeerSessionFactory.makeRecipientDevices` (`:280-286`) | falls back to **identity-only** coder while `peer.devices` is empty (`:203-212`) |

**Pre-handshake fallback.** Before the peer roster is known, iOS (and the request itself)
use the **identity-level** coder: ECDH against the peer's *identity* chat key, no per-device
wrapping. This is the bare `RemoteMessage` PUSH wire format (`ChatPushMessageCoder.swift:31-44`).
Desktop has an identity-conflated fallback in the coder but **`startSession`/`send` refuse to
run with an empty roster** — Desktop is the strictest of the three.

> Decode selection (iOS `MultiDeviceAwareStatementDataCoder.swift:61-71`): a frame from an
> *unknown* sender statement account ⇒ `deviceEntryNotFound` ⇒ dropped. This is the
> "Android→iOS in-app messages silently dropped" symptom — same root cause as an empty/stale
> peer roster.

### How the PEER roster gets populated (the only ways)

| Trigger | Desktop | Android | iOS |
|---|---|---|---|
| Incoming request body carries sender device | `upsertContactWithDevice(senderDeviceStmtAcct, senderDevicePubKey)` `managerV2Factory.ts:1139` | `savePeerDevice` → synthetic `DeviceAdded` `IncomingChatRequestProcessor.kt:325` | `extractSenderDevice` → `deviceAdded` msg `NewIncomingChatRequestMapper.swift:56` |
| Peer accepts our request (`DeviceChatAccepted`) | matcher `upsertContactWithDevice(acceptorDevice)` `:466` | `saveAcceptorDevice` `ChatRequestAcceptProcessor.kt:70` | `storePeerDevices` `ChatRequestAcceptProcessorContext.swift:74` |
| Peer's PApp fan-out (`DeviceAdded` on identity channel) | identity-channel listener `:317-340` | `DeviceLifecycleMessageProcessor` (origin=Contact) | `DeviceUpdateProcessor.swift:59-82` |
| **Sibling told us via MDS** | applier `deviceAdded`/`deviceChatAccepted` `applier.ts:262-340` | `applyMessages` → save → `DeviceLifecycleMessageProcessor` | `DeviceSyncIncomingUpdateApplier` |

---

## 2. Sync (MDS) — the wire contract

Sibling devices sync over a WebRTC data channel. The payload is a versioned SCALE
`SyncUpdate { entities[], timePoint }`. **The four entity types and codec indices are identical
across platforms** (verified: Desktop `wireChatMessage.ts:58-80` content enum, Android
`SyncScale.kt:36-48`, iOS `DeviceSyncMessage.swift:7-21`):

| Entity | idx | Payload | Producer | Consumer |
|---|---|---|---|---|
| `Devices` | 0 | own sibling roster `{stmtAcct, encPub, status, lastUpdate}` | mobile (SSO sessions); **Desktop: none** | **everyone ignores inbound** — own SSO list is authoritative (Android `SyncEntityApplier.kt:32`, Desktop `applier.ts:392` only persists, iOS no-op) |
| `ChatsAdded` | 1 | `[Contact(accountId)]` — **accountId only** | established contacts changed since checkpoint | resolve identity from chain, create contact+room |
| `ChatsRemoved` | 2 | `[Contact(accountId)]` | tombstones | delete contact+room |
| `Messages` | 3 | `[{remote: ChatMessageStatement, peerId, status, order}]` | chat messages incl. `deviceAdded@17` / `deviceChatAccepted@20` rows | save / apply |

**Two non-obvious wire rules that make cross-platform interop work:**

1. **`ChatsAdded` carries only an accountId.** The receiver must resolve the peer's chat key +
   username from the on-chain `Resources.Consumers` entry to build a usable contact.
   - Desktop: `applier.ts:96-119` via injected `resolveConsumerInfo`.
   - Android: `addAlreadyEstablishedContactsById` → `resolveConsumers` `RealAddContactUseCase.kt:88-91`, sets `establishedAt=now` `:138`.
   - **Both skip the contact if the chain returns no ConsumerInfo** (Desktop `:107-112`, Android `:44-47`). One-shot, not retried (checkpoint advances regardless).

2. **Peer-device roster is replicated as `deviceAdded`/`deviceChatAccepted` *chat-message rows*,
   and the wire `status` direction is load-bearing.** There is **no** peer-device SyncEntity.
   On the receiver, `status=Incoming` ⇒ the message is attributed to the peer
   (`origin=Contact`); `status=Outgoing` ⇒ attributed to self (`origin=User`).
   - Android decides origin purely from the synced direction: `RealApplyRemoteChatMessageUseCase.kt:40`
     `authorAccountId = isOutgoing ? our : peer`. Then `DeviceLifecycleMessageProcessor.kt:24`
     **only stores the device if `origin==Contact`**. ⇒ **a synced `deviceAdded` must be
     stamped `Incoming` or Android drops it.**
   - Desktop symmetrically only applies these tags when `status==Incoming` (`applier.ts:245`).

This is why Desktop stamps `deviceAdded` `incoming/seen` in **both** accept paths
(`managerV2Factory.ts:1177` acceptRequest, `:539` matcher) — so the row survives Android's
`origin==Contact` gate on the sibling.

### Checkpoint semantics
Per-peer wall-clock checkpoint captured at the *start* of the round, advanced only on Ack
(Desktop `collector.ts:183` + `repository.ts` `outgoingUpdateTime`; Android `DeviceSyncEngine.kt:176-207`).
Filtered items don't advance individually — their next mutation bumps `lastUpdate` and they
re-appear. **Consequence: anything dropped by the applier (not by the collector) is gone for
good unless re-emitted by a future local mutation.**

### Establishment filter (what is allowed to sync)
A contact only syncs once its request is *established* — otherwise a pending outgoing request
would surface on the sibling as a normal writable chat.
- Android: `DeviceSyncFilter.isContactSyncable = establishedAt != null` (`DeviceSyncFilter.kt:7`); contacts carry an explicit `establishedAt`.
- Desktop: **no `establishedAt` column** — emulated by "no pending request for this peer"
  (`collector.ts:169-172`). Functionally equivalent for the happy path; see Gap G3.
- **Chat-request *state* itself is never a SyncEntity on any platform.**

---

## 3. Case matrix — Desktop sibling ⇄ Android sibling, chatting with peer B

Scenario: user *A* is paired across **Desktop (A_d)** + **Android (A_a)**. They chat with peer *B*
(iOS or Android). "Hub" = the device that performed the action; "sibling" = the device that must
catch up via MDS. Peer *B* is assumed on-chain registered unless noted.

### Case 1 — A_d sends a request, B accepts (outgoing-accept on Desktop)
Hub A_d (`watchForAcceptSignalV2` matcher, `managerV2Factory.ts:426-555`):
1. flip request → accepted (`:460`); `upsertContactWithDevice(B, acceptorDevice)` bumps `lastUpdate` (`:466`, `:158`).
2. write `deviceChatAccepted` row **incoming/seen** (`:511`); write `deviceAdded` row **incoming/seen** (`:539`); `req-accepted` contactAdded.
3. fan out A_d's *sibling* devices to B on the device channel (`:557-608`).

Sync A_d → A_a: emits `ChatsAdded(B)` + `Messages[deviceAdded(B,Incoming), deviceChatAccepted(B,Incoming)]`
(contactAdded is dropped from the wire, `collector.ts:218`).

Apply on A_a:
- `ChatsAdded(B)` → `addAlreadyEstablishedContactsById` → resolves chain → `Contact(B)`, `establishedAt=now`, room created. ✅
- `deviceAdded(B,Incoming)` → `origin=Contact` → `DeviceLifecycleMessageProcessor` → `ContactDevicesRepository.addDevice(B)`. ✅ **A_a can now route to B.**
- `deviceChatAccepted(B,Incoming)` → saved; `ChatRequestAcceptProcessor` finds no pending *outgoing* request on the sibling, no-op. Harmless (roster already set by `deviceAdded`).

**Verdict: works, *iff* the chain resolve for B succeeds on A_a.**

### Case 2 — A_d accepts an incoming request from B (incoming-accept on Desktop)
Hub A_d (`acceptRequest`, `:1065-1300`): flip→accepted; `upsertContactWithDevice(B)`;
`deviceAdded` row **incoming/seen** (`:1177`); `deviceChatAccepted` row **outgoing/delivered** (`:1218`);
post `deviceChatAccepted` to B on the identity channel; fan out siblings.

Sync A_d → A_a: `ChatsAdded(B)` + `Messages[deviceAdded(B,Incoming), deviceChatAccepted(B,Outgoing)]`.

Apply on A_a:
- `ChatsAdded(B)` → Contact(B). ✅
- `deviceAdded(B,Incoming)` → `origin=Contact` → roster gets B. ✅
- `deviceChatAccepted(B,Outgoing)` → `origin=User` → `DeviceLifecycleMessageProcessor` ignores
  (not its tag anyway) and accept processor ignores. Harmless.

**Verdict: works, same chain-resolve caveat.**

### Case 3 — A_a (Android hub) establishes with B, A_d (Desktop) is the sibling — REVERSE
Hub A_a stores B's device via `savePeerDevice`/`saveAcceptorDevice` as an **incoming**
`DeviceAdded` chat row, marks contact `establishedAt`. Collector emits `ChatsAdded(B)` +
`Messages[deviceAdded(B,Incoming), ...]` in order `[ChatsAdded, …, Messages]`.

Apply on A_d (`applier.ts`):
- `ChatsAdded(B)` → `resolveConsumerInfo(B)` → `Contact(B){devices:[]}` + room (`:115-136`). ✅ *iff resolve succeeds.*
- `deviceAdded(B,Incoming)` → **requires `Contact(B)` to already exist** (`applier.ts:262-267`);
  if it does, B is added to `Contact(B).devices`. ✅

**Verdict: works in a single batch.** ⚠️ **But see G1/G2:** if `resolveConsumerInfo(B)` returns
null (B not yet on-chain, or an RPC blip), `ChatsAdded` is skipped **and** the same-batch
`deviceAdded` is dropped with `"contact unknown — skipping"` — and the checkpoint advances, so
**neither is ever retried.** A_d is left permanently unable to message B.

### Case 4 — steady-state message both ways
Once both rosters are populated, `Messages` entities replicate chat content; status upgrades
monotonically (`applier.ts:73-76`). Symmetric and works.

---

## 4. Gap analysis — Desktop is the suspect

The branch has already absorbed most earlier fixes (matcher/acceptRequest now write
`deviceAdded` *incoming*, bump `lastUpdate`, drop legacy `contactAdded` from the wire,
align `timePoint`). What remains:

### G1 — **Desktop drops a peer device when the contact isn't resolved yet; Android never does** ⬅ primary
Desktop embeds the peer roster *inside* the `Contact` entity (`Contact.devices[]`), so its
applier **gates `deviceAdded`/`deviceChatAccepted` on contact existence** and silently drops
otherwise (`applier.ts:262-267`, `:288-292`). Android stores the peer roster in a
**contact-independent table** (`ContactDevicesRepository`, written by
`DeviceLifecycleMessageProcessor` with **no contact-existence check**, `DeviceLifecycleMessageProcessor.kt:22-37`).

Consequence: whenever `ChatsAdded` resolution fails or arrives in a *different* sync round than
the `deviceAdded` row, Desktop loses the device permanently (checkpoint advanced, row never
re-emitted because producers dedupe by messageId — `:1157`, `:1166`). The sibling then has a
`Contact` with `devices:[]` and **`chatSessionV2` throws on every send** (`chatSessionV2.ts:167`).
This is the "synced device rows inert → can't route → invisible chat" symptom.

### G2 — **One-shot, non-retried `resolveConsumerInfo` couples contact + device loss**
`ChatsAdded` establishment depends on a single chain lookup; null/throw ⇒ skip, no retry
(`applier.ts:96-113`). Because the device row is dropped in the same pass (G1), a single
transient chain failure loses the *entire* chat on the sibling with no recovery path. Android
shares the resolve dependency but, per G1, at least keeps the device row.

### G3 — **No `establishedAt`; Desktop emulates with "no pending request"**
Desktop has no `establishedAt` column and gates on pending-request absence (`collector.ts:169-172`).
Equivalent for the happy path, but it can't express "established at time T" and re-derives state
from request rows, which the sibling does not have (request state never syncs). Low severity but
a latent divergence from Android's explicit field.

### G4 — **Desktop produces no `Devices` SyncEntity**
No own-roster producer (`collector.ts` has no `Devices` branch). All platforms ignore *inbound*
`Devices`, so this is currently inert — but Desktop siblings can only discover each other through
the PApp-seeded `device-sync` table, never through chat MDS. Note for future, not a today-bug.

---

## 5. Recommended Desktop fix (works with current Android — NOT implemented)

**Make the peer-device roster survive a missing/unresolved contact — matching Android's
contact-independent behaviour — without surfacing an unusable chat.**

Targeted change in `domains/device-sync/applier.ts`, `Messages` handler:

1. **`deviceAdded` / `deviceChatAccepted` for an unknown contact should not be dropped.**
   When `contactRepository.get(peerSs58)` is empty, attempt the same establishment as
   `ChatsAdded` (`ctx.resolveConsumerInfo(peerSs58)` → upsert `Contact` + room), *then* apply the
   device. This both creates the contact the row implies and preserves the device — the single
   action a peer's `DeviceChatAccepted`/`DeviceAdded` is supposed to achieve. (Smallest viable
   step; fixes Case 3's single-batch failure and the common "device row arrived first" ordering.)

2. **If resolution still fails, persist the device against a minimal contact shell** (devices set,
   `identityChatPublicKey` empty) so it is not lost; a later `ChatsAdded`/identity-channel event
   fills the chat key via the existing `upsertContactWithDevice` merge (`managerV2Factory.ts:142-160`,
   which already preserves devices and only overwrites the key when non-empty). Guard the chat-list
   so a shell with no chat key / no established marker isn't shown as a writable chat (mirrors the
   pending-request hiding already in `ChatFullscreen`).

This keeps Desktop's embedded-roster data model but removes the "contact must pre-exist" cliff
(G1) and breaks the contact↔device co-loss (G2). It requires **no Android change** and is
idempotent (existing dedupe-by-`statementAccountId` at `applier.ts:272`, `:297`).

### Test hooks (if/when implemented)
Extend `deviceAddedPropagation.spec.ts`: add a case where the sibling has **no** `Contact(peer)`
and `resolveConsumerInfo` (a) succeeds — expect contact+room+device created; (b) returns null —
expect the device retained (shell) and **not** shown as a writable chat. Add a `collector` case
asserting a re-established contact re-emits its device row.
</content>
