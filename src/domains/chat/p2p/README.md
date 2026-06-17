# chat/p2p

Peer-to-peer (device-to-device) chat over the Bulletin-chain statement store: contact
search, chat requests, the multi-device encrypted session transport, and the local sync
of rooms/messages/requests into Dexie.

## Sub-modules

- `requests/` — chat-request wire format (`schemas`), topic derivation (`service`), and the
  send/decrypt/subscribe wire I/O (`gateway`).
- `session-transport/` — statement-store sign-and-submit + identity/device-channel routing
  (`gateway`), the `ChatMessage` wire codec (`schemas`), and SDK↔UI content mapping (`service`).
- `multi-device/` — the per-device encrypted envelope crypto + assembly (`service`, with its
  `types`/`constants`).
- `notifications/` — **outbound push** notifications to a peer's mobile device: the HTTP send
  path (`gateway`), pure push-id/token helpers (`service`), and the React binding (`hooks`).
- `peer/` — on-chain peer/identity resolution (`gateway`), the network-id boundary schema
  (`schemas`), and pure result helpers (`service`, incl. self-exclusion from search).
- `file-transfer/` — chat file upload/download (`resource`).

## Container-root files

The container's own canonical files: `types`, `schemas`, `service`, `resource`, `repository`,
`hooks`, `index`.

### Orchestration / infra primitives — a deliberate exemption

These container-root files are **multi-source orchestration or process-wide infra** that has no
canonical *leaf* file kind. Cross-source orchestration normally lives in `$usecase/`, but
`$usecase/` is **domain-root-only** (`chat/`), and this logic is p2p-specific — lifting it to the
chat domain root would pollute the whole domain with p2p internals. They are kept here, named for
what they are, by design (see `docs/code/code-placement.md` § Container-root orchestration):

- `managerV2Factory.ts` — `createP2PChatManagerV2`, the central lifecycle that wires every
  sub-module (resources, gateways, services, repository, subscriptions) into the live manager
  consumed by the `aggregates/p2p-chat` aggregate.
- `chatSessionV2.ts` — `createChatPeerSessionV2`, the per-peer encrypted session transport.
- `session.ts` — `createP2PChatSession`, builds a UI `ChatSession` from a room + manager.
- `subscription-registry.ts` — process-wide statement-store subscription registry + budget
  (`trackedSubscribeStatements`, `SUBSCRIPTION_BUDGET`); a singleton by nature, not a leaf kind.

### `notificationService.ts` vs `notifications/`

Two distinct concerns that both say "notification":

- `notifications/` (sub-module) = **outbound push** — encrypts and POSTs a push to a peer's
  mobile device when we send them a message.
- `notificationService.ts` (root) = **inbound local OS** — subscribes to the room/message
  resources and fires desktop OS notifications / badge counts for *our* unread messages. It is
  effect-orchestration over domain resources (same exemption class as the files above), started
  and stopped from the aggregate's headless binding via `notifications/hooks.ts`.
