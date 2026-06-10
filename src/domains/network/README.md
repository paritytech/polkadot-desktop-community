# network

The `network` domain is the renderer's bridge to Polkadot-shaped chains: the catalog of chains the app speaks to, the typed RPC clients used to talk to them, the address/account-id encoding, the block stream, and helpers for Bulletin-chain content (preimages).

It is deliberately a **read/connect** layer. It owns *how* to reach a chain and *how* to interpret the values it returns. It does not sign, it does not move funds, and it does not encode product behavior.

## Vocabulary

- **Chain** — A network the app supports. Carries the `chainId` (genesis hash, branded), `specName`, address prefix, native and supplementary assets, RPC endpoints, explorers, and (for parachains) a `parentId`.
- **Asset** — A fungible token on a chain. Discriminated by `type`: `native`, `orml`, or `statemine`. Carries `LocalAssetId` (its index within the chain), the on-chain `ChainAssetId`, precision, symbol, optional `priceId`, and icon URLs.
- **AccountId** — 32-byte branded hex identifier — the binary form of a Substrate account.
- **Address** — The user-facing form of an account: SS58 for Substrate accounts, hex for EVM (20 bytes). Encoding/decoding to/from `AccountId` is part of this domain.
- **Block** — `BlockHeight` (non-negative integer) and `BlockHash` (branded hex).
- **API** — A typed RPC client for a specific chain (Polkadot, Polkadot Asset Hub, Kusama, Westend, Paseo, Bulletin, …) built from `@polkadot-api/descriptors` and routed through the `chainRegistry`.
- **Preimage** — A content blob a product stores via the **Bulletin chain** (`TransactionStorage`), addressed by its BLAKE2b-256 hash. The bytes are retrieved from IPFS, where that hash is also the content's CID. Products submit preimage bytes and look them back up by hash. (Bulletin-chain content addressing — *not* a governance / runtime-call preimage.)

## Scope

This domain owns:

- The **chain catalog** — loading the curated chain list and shaping it for the rest of the app (sorting, parent/child resolution, asset-type tagging).
- The **chain registry** — connection lifecycle, light-client setup, metadata caching, and the typed-client factory.
- **Address ↔ account-id encoding** — SS58 for Substrate, hex for EVM, with format chosen from the chain's prefix.
- **Block streams and timing** — best/finalized block height and hash, block-time estimation, and timestamp lookups.
- **Preimage retrieval** — computing the BLAKE2b-256 key for a content blob and fetching the bytes from IPFS (Bulletin-chain stored content).
- **Custom chains** — user-registered Substrate endpoints discovered via JSON-RPC, persisted locally, merged into the chain catalog alongside the curated list.

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
- **Governance, staking, identity, or DeFi business logic.** This domain reads chain state and moves bytes; it does not encode what that on-chain data *means*.
- **Aggregate state** — current network selection, endpoint mode, multi-chain orchestration — those live in aggregates (`aggregates/network-settings`, etc.) and are *consumed* from here, not *defined* here.

A useful distinction: `network/account` deals with **identity** (how to encode an address, how to compare account ids); `product/account` deals with **cryptography** (how to derive a key for a product). They are not the same module by accident.

## References

- [Polkadot specification](https://spec.polkadot.network/) — runtime metadata, SCALE codec, block header format.
- [`polkadot-api`](https://github.com/polkadot-api/polkadot-api) — typed RPC client used throughout, with descriptors generated from `@polkadot-api/descriptors`.
- [SS58 registry](https://github.com/paritytech/ss58-registry) — address prefix definitions for Substrate chains.
- [SCALE codec](https://docs.substrate.io/reference/scale-codec/) — wire format underlying chain types.
- [Smoldot](https://github.com/smol-dot/smoldot) — embedded light client used for Polkadot, Kusama, and Westend.
- `src/domains/network/chain/data/chains.json` — the curated chain catalog backing this domain.
