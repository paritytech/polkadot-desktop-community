# chat/p2p

Peer-to-peer (device-to-device) chat over the Bulletin-chain statement store: contact
search, chat requests, the multi-device encrypted session transport, and the local sync
of rooms/messages/requests into Dexie.

## Sub-modules

- `requests/` — chat-request wire format (`schemas`), topic derivation and the identity and cancel proofs (`service`),
  and the send/decrypt/subscribe wire I/O, which checks the inner signature of every request (`gateway`). The manager
  keeps a v2 request only when its identity proof matches the sender's chain chat key.
- `session-transport/` — statement-store sign-and-submit + the device-channel one-shot fallback
  (`gateway`), and SDK↔UI content mapping plus identity-channel event interpretation (`service`).
  The `ChatMessage` wire codec is the SDK's (`@novasamatech/host-chat/codec/message`); the
  per-device envelope crypto is the SDK's too.
- `notifications/` — **outbound push** notifications to a peer's mobile device: the HTTP send
  path (`gateway`), pure push-id/token helpers (`service`), and the React binding (`hooks`).
- `peer/` — peer lookup: HTTP username search against the identity backend plus on-chain identity
  resolution (`gateway`), the boundary schemas for the search envelope and the proof-of-compute
  puzzle (`schemas`), and pure helpers (`service`) — self-exclusion from search results, and the
  proof-of-compute work function.
- `file-transfer/` — chat file **upload** to the HOP relay (`gateway`); the endpoints arrive as a
  parameter from `chat/$usecase/fileTransfer.ts`. There is deliberately no download counterpart: the
  HOP claim is one-shot, so claiming on desktop would deny the mobile recipient, and
  `AttachmentRenderer` renders a placeholder instead.

## Container-root files

The container's own canonical files: `types`, `schemas`, `service`, `resource`, `repository`,
`hooks`, `index`.

### Orchestration / infra primitives — a deliberate exemption

These container-root files are **multi-source orchestration or process-wide infra** that has no
canonical _leaf_ file kind. Cross-source orchestration normally lives in `$usecase/`, but
`$usecase/` is **domain-root-only** (`chat/`), and this logic is p2p-specific — lifting it to the
chat domain root would pollute the whole domain with p2p internals. They are kept here, named for
what they are, by design (see `docs/code/code-placement.md` § Container-root orchestration):

- `managerV2Factory.ts` — `createP2PChatManagerV2`, the central lifecycle that wires every
  sub-module (resources, gateways, services, repository, subscriptions) into the live manager
  consumed by the `aggregates/p2p-chat` aggregate.
- `chatSessionV2.ts` — `createChatPeerSessionV2`, the per-peer **device-level** session transport
  (SDK `createMultiDeviceSession`); carries ordinary chat messages and also sends the transient seen receipts.
- `identityChannel.ts` — `createIdentityChannel`, the per-peer **identity-level** session (SDK
  `createSession`); carries the variants that bootstrap device transport and therefore cannot use
  it — `deviceChatAccepted`, `deviceAdded`/`deviceRemoved`. Same class and shape as
  `chatSessionV2.ts`, so it sits beside it rather than inside `session-transport/`, which is a leaf.
- `peerRoster.ts` — `createPeerRoster`, the live device-list handle a running session reads
  through on every submit. Mutable per-session infra, not a stateless helper, so `service.ts`
  cannot hold it; created and owned by `managerV2Factory.ts`.
- `session.ts` — `createP2PChatSession`, builds a UI `ChatSession` from a room + manager.
- `subscription-registry.ts` — process-wide statement-store subscription registry + budget
  (`trackedSubscribeStatements`, `SUBSCRIPTION_BUDGET`); a singleton by nature, not a leaf kind.

### `notificationService.ts` vs `notifications/`

Two distinct concerns that both say "notification":

- `notifications/` (sub-module) = **outbound push** — encrypts and POSTs a push to a peer's
  mobile device when we send them a message.
- `notificationService.ts` (root) = **inbound local OS** — subscribes to the room/message
  resources and fires desktop OS notifications / badge counts for _our_ unread messages. It is
  effect-orchestration over domain resources (same exemption class as the files above), started
  and stopped from the aggregate's headless binding via `notifications/hooks.ts`.
