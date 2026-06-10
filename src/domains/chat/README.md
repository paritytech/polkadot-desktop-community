# chat

The `chat` domain owns messaging in the app: peer-to-peer conversations between users, product-scoped rooms exposed to running products, message persistence, file attachments, and reactions. It is built on top of the on-chain Statement Store as a transport — the chain is used as a message bus, not the wallet.

The unit of consumption is a **`ChatSession`**: a uniform observable interface that both P2P chats and product chats implement, so the UI does not need to know which kind it is dealing with.

## Vocabulary

### Session-level (transport-agnostic)

- **ChatSession** — Observable façade over a single conversation: messages stream, peer metadata, send, mark-as-read. The same shape regardless of whether the conversation is P2P or product-scoped.
- **ChatMessage** — Immutable record on the session: `messageId`, `peer`, `content`, `status`, `timestamp`.
- **ChatMessageStatus** — Either an outgoing lifecycle (queued / submitting / delivered / failed) or an incoming state (read / unread).
- **MessagePeer** — Who a message is from. One of `UserPeer` (an account, optionally pinned), `P2PPeer` (an SS58 account string in a P2P session), or `ProductPeer` (a product instance).
- **MessageContent** — Tagged union covering `Text`, `RichText` (text + attachments), `Custom` (typed binary payload), `Reaction`, `Reply`, `Edit`, plus lifecycle events (`ContactAdded`, `LeftChat`).
- **FileAttachment** — `{ identifier, claimTicket, meta }`. The `meta` discriminates `General` / `Image` / `Video`.

### P2P-specific

- **P2PRoom** — An end-to-end-encrypted session between two peers, identified by `sessionId` and the peer's SS58 account, carrying the peer's P-256 public key and (optionally) push-notification routing.
- **P2PChatRequest** — The handshake that creates a room: direction (incoming/outgoing), status, optional welcome message, and a `channelTopic` derived from an ephemeral ECDH exchange.
- **ChatKeys** — The per-device crypto material: the SS account secret, the P-256 keypair, and the owning `accountId`.
- **Outbox** — Per-peer send pipeline for V2 sessions: the unacked **batch** (every message the peer hasn't ACKed yet, all carried by the latest statement on the channel) plus a FIFO **queue** of parked messages that didn't fit the statement-store's ~2KB data budget. The queue drains into the batch when the peer ACKs, at session start, and on a timed retry after a transient submit failure; a parked head that can no longer fit a statement alone (e.g. the peer's device roster grew) is dropped as undeliverable instead of wedging the FIFO. Batch, request coverage, and queue are persisted to localStorage per (user, peer), so both survive an app restart.

### Product-specific

- **ProductChatRoom** — A room scoped to a product instance (`productId`, `roomId`, `name`, `icon`, …). A product can drive a chat by writing into a room it owns; users see it as a normal session.

### Reactions and rendering

- **ReactionAggregate** — `{ emoji, count, reactedByMe, reactors[] }` summarizing a message's reactions.
- **Custom renderer** — The plugin system that lets a product define how its custom message types are drawn, using the host UI primitive tree (Box / Column / Row / Text / Button / TextField / …) shared with `@novasamatech/host-api`.

## Scope

This domain owns:

- **Message lifecycle** end-to-end: composition, send, delivery state, read state.
- **P2P discovery and handshake** — chat-request exchange, peer verification, channel-topic derivation.
- **End-to-end encryption** — per-peer sessions on top of statement-store sessions, with shared secrets derived via P-256 ECDH.
- **File transfer** — upload to and download from the HOP relay (`@novasamatech/handoff-service`), encryption, retry on transient connection issues, and surfacing files via `claimTicket`.
- **Persistence** — rooms, messages, and requests in IndexedDB; the V2 outbox (batch + queue) in localStorage; live queries fanned out as reactive streams.
- **Reactions** — aggregation and per-reactor tracking.
- **Custom-message rendering hooks** — registration and dispatch of product-supplied renderers.

## Boundaries

This domain does **not** own:

- **The transport itself.** The statement-store (subscribe/publish, block inclusion, retries at the protocol level) is owned by `domains/application`. Chat treats the statement-store session as a black box.
- **Identity and key management at the user level.** Account identity comes from the host-papp / wallet layer; chat receives ChatKeys, it does not mint them.
- **Networking primitives.** No libp2p, gossipsub, or transport selection lives here — the statement-store abstracts that away.
- **UI rendering.** Message bubbles, compose UI, media galleries, emoji pickers — all in features. Chat exports types and observable streams.
- **Bulletin-chain RPC configuration.** File transfer uses the bulletin chain, but connection / endpoint configuration is owned by `domains/application` and `domains/network`.
- **Single-feature messaging side-channels.** A short-lived command bus inside one feature does not belong here.

## References

- [`@novasamatech/statement-store`](https://www.npmjs.com/package/@novasamatech/statement-store) — Session, encryption, Sr25519/P-256 primitives, and topic-hash (`khash`) derivation.
- [`@novasamatech/host-chat`](https://www.npmjs.com/package/@novasamatech/host-chat) — Wire-level message codec used to encode `MessageContent`.
- [`@novasamatech/handoff-service`](https://www.npmjs.com/package/@novasamatech/handoff-service) — HOP file relay (upload / download by `identifier` + `claimTicket`).
- [`@novasamatech/host-api`](https://www.npmjs.com/package/@novasamatech/host-api) — UI-primitive tree (`CustomRendererNode`, modifiers, color tokens) shared with the custom-renderer plugin protocol.
