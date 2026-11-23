# device-sync

The `device-sync` domain owns **multi-device state replication over peer-to-peer WebRTC**: keeping a
user's chats, contacts, and message statuses consistent across every device they've paired, by
discovering peer devices, opening encrypted data channels to them, and applying the sync entities that
flow across. It owns the device roster (`KnownUserDevice`), the wire format for sync messages, the
persisted sync cursor, and the connection/sync status the UI reflects.

The orienting idea: this domain is a **live replication engine**, not a request/response data source.
Its core is a long-running orchestration over WebRTC transports and a state machine — closer in shape
to a background service than to a gateway+resource read path. That shape is why much of it is framed as
container-root infra below rather than decomposed into the usual leaf artifacts.

## Vocabulary

- **Device** — one installation paired into the user's multi-device set. **`KnownUserDevice`** is the
  roster entry (its statement account id, encryption public key, and `status: 'active' | 'removed'`).
  Use "device", not "peer key" or "node", for a roster member.
- **Peer** — a `KnownUserDevice` we are (or could be) connected to over WebRTC. "Peer" is the runtime
  relationship; "device" is the persisted identity.
- **Sync entity** — a unit of replicated state on the wire: `Devices`, `ChatsAdded`, `ChatsRemoved`,
  `Messages` (see the `SyncEntity` codec). The atom the collector emits and the applier consumes.
- **Connection phase** (`DeviceSyncConnectionPhase`: `inactive | connecting | syncing | synced |
disconnected | error`) — the raw transport-level lifecycle of the active session.
- **Sync status** (`DeviceSyncStatus`: `inactive | syncing | synced | stale | error`) — the
  **semantic** state the UI maps to presentation. Distinct from connection phase: `stale` is derived
  (synced-then-disconnected past `DEVICE_SYNC_STALE_AFTER_MS`), not a transport phase. The domain
  exposes this semantic status; the feature decides how to render it.
- **Local-change → sync pump** — a local mutation (a contact write, a chat change) signals
  `signalLocalChange()`, which nudges the orchestrator to push the change to peers.

## Scope

This domain owns:

- **The device roster** — `KnownUserDevice` persistence (`repository.ts`) and reads (`resource.ts`).
- **The sync wire format** — SCALE codecs (`schemas.ts`), byte-for-byte matched to Android; it reuses
  the chat domain's `ChatMessage` codec so envelopes decode identically to the live chat channels.
- **The replication engine** — peer discovery, WebRTC signaling, the sync state machine, and applying
  inbound / collecting outbound sync entities (the deferred infra layer, below).
- **The user-facing sync status** — the semantic `DeviceSyncStatus` stream (`hooks.ts`).

## Deferred infra layer (acknowledged, not oversight)

Most of this domain's engine is **critical, tightly-sequenced infra over live WebRTC sync** and is the
strongest aggregate-candidate in the codebase. Migrating it (orchestration → `$usecase/`,
`connectionPhase$` → an aggregate) is a deliberate future effort, not folded into the canonicalization
that produced this README. Until then these files stay as named container-root primitives, framed here
(the same treatment as `network/api/registry`, the statement-store adapter, and `application/papp-provider`):

- **`orchestrator.ts`** — the long-running engine: owns peer connections, drives the sync loop, wires the
  local-change pump. Cross-source orchestration awaiting the domain-vs-aggregate decision.
- **`signaler.ts`**, **`syncStateMachine.ts`** — WebRTC offer/answer/candidate signaling and the
  per-peer sync state machine.
- **`applier.ts`** / **`collector.ts`** — apply inbound sync entities to local stores / collect local
  changes into outbound entities. _Known deferred leak:_ these deep-import other domains'
  repositories (`@/domains/chat/p2p/repository`, `@/domains/contact/identity/repository`) with an
  `eslint-disable boundaries/dependencies` — a wasm-load workaround; a use case should reach other
  domains' public surfaces, so this rides the orchestration→`$usecase` migration.
- **`wiring.ts`** — reactive orchestrator lifecycle: `startDeviceSyncOnIdentity` (re)starts/stops the
  orchestrator as `userIdentity$` settles, sequencing aborts so two orchestrators never race. That is
  orchestration, not host `bootstrap.ts` wiring, so it stays here.
- **`resource.ts`'s `connectionPhase$`** — a module-level `BehaviorSubject` + `trackedPeerId`: in-flight
  runtime state that, per the settled rule, belongs in an aggregate. The strongest single aggregate
  trigger; deferred with the engine.
- **`localChangeSignal.ts`** — `localSyncSignal$`, a module-level `Subject` used as a cross-domain
  signal bus (emit-side re-exported as `signalLocalChange`, consumed by contact/chat write paths). Its
  `createSideEffect` (DI) conversion is deferred.
- **Public surface** — `index.ts` exposes `deviceSyncRepository` directly (consumed by `chat/p2p` and
  `application/papp-provider`); the raw repository should become service/use-case methods. Deferred.

## Flows

- **Start / restart** — `startDeviceSyncOnIdentity` subscribes `userIdentity$`; on a settled identity it
  spawns the orchestrator (tearing down any previous run first). Called once from the app bootstrap.
- **Inbound sync** — a peer's `SyncMessage` arrives on the transport → the state machine advances →
  `applier.ts` writes the entities to the relevant domain stores.
- **Outbound sync** — a local mutation calls `signalLocalChange()` → the orchestrator wakes →
  `collector.ts` gathers changed entities → pushes them to connected peers.

## Boundaries

This domain does **not** own:

- **Chat / contact data** — it _replicates_ into those domains' stores; they own the entities.
- **The user identity / pairing handshake** — owned by `sso` + `application/papp-provider`;
  device-sync only reads the settled `userIdentity$` to know whom to sync with.
- **The statement-store transport policy** — `signAndSubmitStatement` and the adapter live in
  `@/shared/statement-store` + `application`.

## References

- [`@novasamatech/statement-store`](https://www.npmjs.com/package/@novasamatech/statement-store) — the
  bulletin-chain statement transport signaling rides on.
- `schemas.ts` — the SCALE sync-wire codecs (Android parity: `SyncScale.kt`, `LocalMessageScale.kt`).
- `types.ts` — `KnownUserDevice`, `DeviceSyncStatus`, `DeviceSyncConnectionPhase`, `ChatIdValue`.
