# chat

The `chat` domain owns messaging in the app: peer-to-peer conversations between users, product-scoped rooms exposed to running products, message persistence, file attachments, and reactions. It is built on top of the on-chain Statement Store as a transport — the chain is used as a message bus, not the wallet.

The unit of consumption is a **`ChatSession`**: a uniform observable interface that both P2P chats and product chats implement, so the UI does not need to know which kind it is dealing with.

## Vocabulary

### Session-level (transport-agnostic)

- **ChatSession** — Observable façade over a single conversation: messages stream, peer metadata, send, mark-as-read. The same shape regardless of whether the conversation is P2P or product-scoped.
- **ChatMessage** — Immutable record on the session: `messageId`, `peer`, `content`, `status`, `timestamp`.
- **ChatMessageStatus** — Either an outgoing lifecycle (new / sent / delivered) or an incoming state (new / seen). Seen on an outgoing message is derived, not a stored state (see **Seen**).
- **MessagePeer** — Who a message is from. One of `UserPeer` (an account, optionally pinned), `P2PPeer` (an SS58 account string in a P2P session), or `ProductPeer` (a product instance).
- **MessageContent** — Tagged union covering `Text`, `RichText` (text + attachments), `Custom` (typed binary payload plus an optional `alt`: the one line shown where the message is listed without being drawn), `Reaction`, `Reply`, `Edit`, plus lifecycle events (`ContactAdded`, `LeftChat`).
- **FileAttachment** — `{ identifier, claimTicket, meta }`. The `meta` discriminates `General` / `Image` / `Video`.
- **Seen receipt** — the transient `seen` message that tells the peer how far the local user has read (RFC 0006). It is never stored, synced or pushed. Use seen receipt, not read receipt or watermark.
- **Seen** — the derived state of an outgoing message: the peer has seen it, because the message is `sent` or `delivered` and its position is at or before the peer seen position. It is never a stored status. The incoming state `seen` (the local user displayed a message) keeps its name. Seen on an outgoing message always means the peer saw it.
- **last seen message** — the newest incoming message the local user has displayed, the one a seen receipt names. Only counted content qualifies: text, rich text, reply, transfer and call signals other than ICE; custom payloads, reactions, edits, ICE call signals and protocol events (contact added, left chat, token, device rows) do not.
- **message position** — `{ timestamp, messageId }`, the place of a message in the chat. Positions compare by `timestamp`, then by `messageId` in UTF-16 code-unit order.
- **blurhash** — the decoded preview string carried by `Image` / `Video` meta. It rides inline in the statement (not over HOP), so rendering it claims nothing. Use **`blurhash`** for the decoded domain string; the raw wire field is **`thumbnail`** (`Option(Bytes)`, the UTF-8 bytes of the blurhash) — say `thumbnail` only when talking about the on-wire bytes, `blurhash` everywhere else.

### P2P-specific

- **P2PRoom** — An end-to-end-encrypted session between two peers, identified by `sessionId` and the peer's SS58 account, carrying the peer's username and (optionally) push-notification routing.
- **P2PChatRequest** — The handshake that creates a room: direction (incoming/outgoing), status, optional welcome message, and a `channelTopic` derived from an ephemeral ECDH exchange. Two statuses are tombstones: `removed` (the user left the chat) and `cancelled` (a cancel was sent or applied), both kept so that a later copy of the request cannot bring it back.
- **peer seen** — the furthest message position the peer has reported seen, kept on the room; it only advances.
- **last sent seen** — the last message position the local user reported seen to the peer, kept on the room so the same receipt is not sent twice.
- **Device-local room field** — a `P2PRoom` field written without stamping `lastUpdate` and without `signalLocalChange` stays on this device (`isBlocked`, `peerSeen`, `lastSentSeen`).
- **Cancel** — the sender withdraws its own pending outgoing request (RFC 0007); the receiver drops it. Only the sender cancels.
- **Decline** — the receiver refuses an incoming request. Only the receiver declines.
- **Proof of compute** — a puzzle the identity backend's username-search route may demand from an
  unauthenticated caller: mine a counter whose work digest has enough leading zero bits, and present
  it in a `Proof-Of-Compute` header. **Opportunistic, never required by this host** — deployments
  ship it disabled, and when no puzzle is on offer (or mining exceeds its budget) search runs
  anonymously exactly as before. Say "proof of compute", not "proof of work": the backend's route,
  header and configuration all use the former.
- **Batch** — the unacked set for a V2 session: every message the peer hasn't ACKed yet, all carried on the latest statement of the channel, so one response acknowledges the whole set. The SDK's multi-device session owns it and reads it back out of the statement store on init — the store is the source of truth, this domain persists nothing for it.

### Product-specific

- **ProductChatRoom** — A room scoped to a product instance (`sessionId`, `roomId`, `productId`, `userId`, `createdAt`, `footer`). A product can drive a chat by writing into a room it owns; users see it as a normal session.
- **Room footer** — What a product room shows below its messages: `text` — the user's text input; `none` — nothing, the product drives the room and the user does not write messages into it (reactions unaffected; not enforced on send); `card` — a card the product draws (`productId`, `messageType`, `payload`). Absent reads as `text`. The product sets it through TrUAPI's room footer.

### Reactions and rendering

- **ReactionAggregate** — `{ emoji, count, reactedByMe, reactors[] }` summarizing a message's reactions.
- **Renderer tree** — The plugin system that lets a product define how its custom message types are drawn, using the host UI primitive tree (Box / Column / Row / Text / Button / TextField / Image / …) the TrUAPI core defines (`RendererNode` in `@parity/truapi`). The tree comes from the product that owns the room, over its worker's core connection (`render`, addressed by a `RenderContext::ChatMessage`, or by a `RenderContext::ChatRoomFooter` (`roomId`, `messageType`) for a footer card); a tapped control goes back on the renderer's own action stream (`publishRendererAction`), naming that same context — **not** as an `ActionTriggered` chat action, which is reserved for buttons the _host_ draws for an `Actions` message. A render that fails reports through `onError`, and the host drops the partial tree rather than leaving it on screen as the product's finished output.

## Scope

This domain owns:

- **Message lifecycle** end-to-end: composition, send, delivery state, read state. A chat is marked read, and so sends a seen receipt, only while it is displayed in a focused window.
- **P2P discovery and handshake** — chat-request exchange, peer verification, channel-topic derivation.
- **End-to-end encryption** — per-peer sessions on top of statement-store sessions, with shared secrets derived via X25519 ECDH.
- **File transfer** — upload to and download from the HOP relay (`@novasamatech/handoff-service`), encryption, retry on transient connection issues, and surfacing files via `claimTicket`.
- **Persistence** — rooms, messages, and requests in IndexedDB; live queries fanned out as reactive streams. The V2 unacked batch is not persisted here — the statement store holds it and the SDK session restores it on init.
- **Reactions** — aggregation and per-reactor tracking.
- **Custom-message rendering hooks** — registration and dispatch of product-supplied renderers.

## Boundaries

This domain does **not** own:

- **The transport itself.** The statement-store (subscribe/publish, block inclusion, retries at the protocol level) is owned by `domains/application`. Chat treats the statement-store session as a black box.
- **Identity and key management at the user level.** Account identity comes from the host-papp / wallet layer; chat receives the device and user identities, it does not mint them.
- **Networking primitives.** No libp2p, gossipsub, or transport selection lives here — the statement-store abstracts that away.
- **UI rendering.** Message bubbles, compose UI, media galleries, emoji pickers — all in features. Chat exports types and observable streams.
- **Bulletin-chain RPC configuration.** File transfer uses the bulletin chain, but connection / endpoint configuration is owned by `domains/application` and `domains/network`.
- **Single-feature messaging side-channels.** A short-lived command bus inside one feature does not belong here.

## References

- [Identity backend OpenAPI](https://identity.dotspark.app/docs/openapi.json) — username search,
  and the proof-of-compute puzzle route. Note its prose describes the work preimage in a way that
  reads as string concatenation; the authoritative definition is
  `crates/username-indexer/src/poc/solution.rs` in `paritytech/device-uniqueness-backend-community`, which is
  what `peerSearchService.leadingZeroBits` is ported from and pinned against.
- [`@novasamatech/statement-store`](https://www.npmjs.com/package/@novasamatech/statement-store) — Session, encryption, Sr25519/X25519 primitives, and topic-hash (`khash`) derivation.
- [`@novasamatech/host-chat`](https://www.npmjs.com/package/@novasamatech/host-chat) — Wire-level message codec used to encode `MessageContent`.
- [`@novasamatech/handoff-service`](https://www.npmjs.com/package/@novasamatech/handoff-service) — HOP file relay (upload / download by `identifier` + `claimTicket`).
- [`@parity/truapi`](https://www.npmjs.com/package/@parity/truapi) — UI-primitive tree (`RendererNode`, modifiers, color tokens) shared with the renderer plugin protocol.
