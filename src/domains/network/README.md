# network

The `network` domain is the renderer's bridge to Polkadot-shaped chains: the catalog of chains the app speaks to, the typed RPC clients used to talk to them, the address/account-id encoding, the block stream, and helpers for Bulletin-chain content (preimages).

It is deliberately a **read/connect** layer. It owns _how_ to reach a chain and _how_ to interpret the values it returns. It does not sign, it does not move funds, and it does not encode product behavior.

## Vocabulary

- **Chain** — A network the app supports. Carries the `chainId` (genesis hash, branded), `specName`, address prefix, native and supplementary assets, RPC endpoints, explorers, and (for parachains) a `parentId`.
- **Asset** — A fungible token on a chain. Discriminated by `type`: `native`, `orml`, or `statemine`. Carries `LocalAssetId` (its index within the chain), the on-chain `ChainAssetId`, precision, symbol, optional `priceId`, and icon URLs.
- **AccountId** — 32-byte branded hex identifier — the binary form of a Substrate account.
- **Address** — The user-facing form of an account: SS58 for Substrate accounts, hex for EVM (20 bytes). Encoding/decoding to/from `AccountId` is part of this domain.
- **Block** — `BlockHeight` (non-negative integer) and `BlockHash` (branded hex).
- **API** — A typed RPC client for a specific chain (Polkadot, Polkadot Asset Hub, Kusama, Westend, Paseo, Bulletin, …) built from `@polkadot-api/descriptors` and routed through the `chainRegistry`.
- **Call** — A pallet + method + arguments, as SCALE-encoded call data names them. Decoding call data needs the executing chain's own metadata, so the same bytes name different calls on different runtimes — which is why `useDecodedCall` takes a genesis hash and not just the bytes. Not to be confused with an **extrinsic** (a signed, submittable transaction wrapping a call) or a **payload** (the bytes a signer signs).
- **Stack** — the active environment's signed Trinity stack, as `@/domains/application`'s environment module defines it. The light client runs it.
- **Light spec** — a chain's light-client chain spec, published at the URL the stack's descriptor names for that chain.
- **Monitor** — the live record of each chain the connection pool holds: holders, status, best blocks as bars, light-client phase, sync share and peers. It holds no chain. Only a relay the app itself holds on the light client gets a sync share, so parachain rows have none.
- **Sync share** — the share of its last warp sync the light client proved, kept after the sync. `syncShare` on a monitored chain.
- **Bar** — a best block with the gap since the previous one, classified on time, late or very late against the chain's block time.
- **Chain use** — whether the app uses a chain and how it fares: `unused`, `pending`, `down` or `live`.
- **Role** — `relay`, `assetHub`, `bulletin` or `people`: the environment's role chains, named as the `roles` of `VITE_ENVIRONMENTS` name them, plus the people chain's relay. The type is `KnownChainRole`.
- **Network health** — the verdict over the live chains: `connected`, `syncing`, `unstable`, `offline`, `unused` or `unreachable`. The values are semantic; the words and colours belong to the feature.
- **Known chain and extra** — a known chain is one the environment gives a role; it is always in the monitor, `unused` until held. An extra is any other chain the pool holds (role `null`); it is judged against a typical parachain's block time and leaves the monitor when released.
- **Phase** — how a chain comes up as the light client reports it: `connecting`, `syncing`, `ready`, or `stalled` when it makes no progress. A chain can be `ready` before any block is observed.
- **Alarm** — a chain in use that the light client reports `stalled`. Never raised by overdue blocks alone.
- **Chain health** — the per-chain reading behind the verdict, by `kind`: `offline`, `noEndpoint`, `unused`, `disconnected`, `syncing`, `connecting`, `stalled` or `producing`. A producing chain carries its **live share**, its block time over its measured one, capped at 1, and null until two intervals are measured.
- **Overdue** — a live chain past three block times with no block.
- **Preimage** — A content blob a product stores via the **Bulletin chain** (`TransactionStorage`), addressed by its BLAKE2b-256 hash. The bytes are retrieved from IPFS, where that hash is also the content's CID. Products submit preimage bytes and look them back up by hash. (Bulletin-chain content addressing — _not_ a governance / runtime-call preimage.)

### Consumer identity

Public identities as the People chain records them — what the host looks up about
_another_ account. Ported from `@novasamatech/host-papp`'s identity module when the
host stopped depending on that SDK; only the read this app performs came across
(batch lookup + RFC-0004 key unwrapping), not the SDK's live subscription or its
bespoke storage cache, which `resource.ts` replaces.

Named **consumer identity** after the `Resources.Consumers` storage item, because
"identity" already means two other things here: this install's key material
(`@/domains/device`) and the paired session (`@/aggregates/truapi-runtime`).

- **`ConsumerIdentity`** — one account's chain record: `accountId`, `liteUsername`,
  optional `fullUsername`, `credibility`, `identifierKey`.
- **Credibility** — how the chain vouches for the record: `Lite` (self-asserted) or
  `Person` (attested, with an `alias` and a last-update stamp).
- **Identifier key** — the account's 32-byte X25519 chat key, unwrapped from its
  RFC-0004 container. `null` when the record uses a keypair type this host cannot
  encrypt to — normal for an account that never enabled chat, not a fault. The
  container is 65 bytes because the field predates X25519 (it held an uncompressed
  P-256 point); readers ignore the padding rather than validate it.
- **`consumerIdentityUseCase.getIdentity`** — the public read. Callers outside React
  (the P2P peer resolver) need the value imperatively, and `resource.ts` may not sit
  on the barrel.

Username _search_ is not here: it is an HTTP call to the identity backend, owned by
the surface that holds the endpoint (`chat/p2p/peer`). Contacts are
`@/domains/contact` — this module answers about any account, known or not.

## Scope

This domain owns:

- The **chain catalog** — loading the curated chain list and shaping it for the rest of the app (sorting, parent/child resolution, asset-type tagging).
- The **chain registry** — connection lifecycle, light-client setup, metadata caching, and the typed-client factory. It reads
  `connection/repository.ts` directly rather than through a resource: the transport is chosen synchronously, as a provider is
  constructed. Each consumer of a chain (the registry's own client, and every `getProvider` connection) is its own session, with
  its own request ids and subscription tokens. A chain's follows are spread over connections so that none carries more than the
  transport's follow limit (2 for the light client, 4 for RPC); a new connection opens when none has room and closes when empty.
- **Connection mode** — whether a network is reached through the embedded light client or through RPC nodes. The user's
  **preference** is app-wide (`light-client` / `rpc`) or `advanced`, which defers to a per-network **override**. A network's
  **requested** mode is what the preference and overrides ask for; its **effective** mode is what the wire will actually use once
  light-client availability is applied. A light client is available for a network the active environment's stack lists a light
  spec for; asking for a light client on any other network resolves back to RPC. Persisted locally, keyed by genesis hash.
- **Address ↔ account-id encoding** — SS58 for Substrate, hex for EVM, with format chosen from the chain's prefix.
- **Block streams and timing** — best/finalized block height and hash, block-time estimation, and timestamp lookups.
- **Preimage retrieval** — computing the BLAKE2b-256 key for a content blob and fetching the bytes from IPFS (Bulletin-chain stored content).
- **Custom chains** — user-registered Substrate endpoints discovered via JSON-RPC, persisted locally, merged into the chain catalog alongside the curated list.
- **Call decoding** — turning SCALE call data into a pallet, a method, and arguments against the executing chain's metadata, so a confirmation dialog can name what it is asking the user to approve instead of showing hex.
- **Monitor and health rules** — the pure rules that turn pool activity, best blocks and light-client lifecycles into a monitor model and a network health verdict. The runtime state lives in `@/aggregates/network-monitor`.

## Accessing a chain API

Two shapes reach a chain's typed client, and the choice is about **who owns the connection's lifetime**:

- **`useApi(chain)`** — a React hook that locks the connection for the consuming component's lifetime and releases it on unmount. Use it in components/widgets that must hold a live client while mounted (e.g. a signing modal). This is the React-only entry point — the documented carve-out for orchestration whose lifetime is a component's.
- **`chainRegistry.requestApi(chain, cb)` / `chainRegistry.api$(chain)`** — one-shot (`Promise`) and `Observable` access for **non-React** code: resources, use cases, gateways. The caller owns the subscription window — `requestApi` locks/unlocks around a single callback, `api$` holds the lock for the subscription's life.

Rule of thumb: if a component's mount should hold the connection alive, use `useApi`; for resource reads, use-case orchestration, or any non-React I/O, use `requestApi`/`api$`. Don't call `useApi` from a resource/use case (it can't run hooks), and don't hand-roll a `useEffect` lock when `useApi` already does it.

## Boundaries

This domain does **not** own:

- **Signing, key derivation, or any private-key material.** Product-scoped account keys are derived in `domains/product/account`; user wallet/keystore concerns sit outside the renderer entirely.
- **Wallet state** — selected account, balances, transaction history, fee estimates. None of that lives here.
- **Extrinsic construction or submission flows.** Building, signing, and sending transactions belongs to features that compose the typed clients from this domain with signing from elsewhere.
- **Governance, staking, identity, or DeFi business logic.** This domain reads chain state and moves bytes; it does not encode what that on-chain data _means_.
- **Aggregate state** — current network selection, multi-chain orchestration — those live in aggregates (`aggregates/network-settings`, etc.) and are _consumed_ from here, not _defined_ here. Connection _mode_ is the exception and is owned here: it is persisted, keyed by genesis hash, and read synchronously by the registry when it builds a provider, none of which an aggregate does.

A useful distinction: `network/account` deals with **identity** (how to encode an address, how to compare account ids); `product/account` deals with **cryptography** (how to derive a key for a product). They are not the same module by accident.

## References

- [Polkadot specification](https://spec.polkadot.org/) — runtime metadata, SCALE codec, block header format.
- [`polkadot-api`](https://github.com/polkadot-api/polkadot-api) — typed RPC client used throughout, with descriptors generated from `@polkadot-api/descriptors`.
- [SS58 registry](https://github.com/paritytech/ss58-registry) — address prefix definitions for Substrate chains.
- [SCALE codec](https://docs.substrate.io/reference/scale-codec/) — wire format underlying chain types.
- [`@parity/truapi-provider`](https://github.com/paritytech/truapi) — the embedded light-client transport. The light client runs
  the active environment's stack (`setStack`) and fetches the light specs the stack's descriptor lists. The provider stores
  nothing itself, so this domain stores each chain's warm-start state per stack and genesis hash. The set of networks that can
  serve a light client comes from that descriptor rather than from a table here.
- [Smoldot](https://github.com/smol-dot/smoldot) — the light client truapi-provider embeds.
- `src/domains/network/chain/data/chains.json` — the curated chain catalog backing this domain.
