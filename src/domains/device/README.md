# device

The `device` domain owns the **cryptographic identity shapes** for this installation of Polkadot Desktop: the `DeviceIdentity`
(this device's own keys) and `UserIdentity` (the user's keys, shared across their devices) types, plus the stateless helpers that
derive and validate the keys those shapes hold.

It is a **types + pure-crypto** layer: it defines _what_ a device/user identity is and _how_ to derive or validate a key from
raw secret material, and every helper in `deviceIdentityService` is a pure, synchronous function on `Uint8Array`s. It persists
nothing. Both identities come from the TrUAPI core's session, assembled by the `p2p-chat` aggregate: the device's keys are the
ones the wallet registered at pairing (`deviceStatementAccountId` / `getDeviceStatementKey`, `deviceEncPublicKey` /
`getDeviceEncryptionKey`), so its statements carry the wallet's allowance. They rotate per login.

## Vocabulary

- **`DeviceIdentity`** — the identity of _this_ device: its sr25519 statement account (seed + public key — the device's accountId
  in the multi-device protocol) and its X25519 encryption keypair (used for ECDH key-wrapping in multi-device envelopes). Type:
  `DeviceIdentity` in `identity/types.ts`.
- **`UserIdentity`** — the user's identity, shared across all their devices, populated only after a successful SSO V2 handshake:
  the identity-chat X25519 keypair, the identity sr25519 public key (trust root for `DeviceAdded`/`DeviceRemoved` roster events),
  the root sr25519 public key (parent for product-account soft-derivation), and the authorising peer device's keys. Type:
  `UserIdentity` in `identity/types.ts`.
- **Statement account** — the device's sr25519 keypair used to sign statements as this device. Use this term, not "device key"
  or "signing key", for the sr25519 side. Its secret is schnorrkel's canonical `SecretKey::to_bytes` encoding, as the core serves it.
- **Encryption key** — the device's X25519 keypair used for ECDH (CHAT-RFC-0004). A valid encryption public key is **32 bytes**. X25519 has no on-curve validation — any 32 bytes is a valid public key — so validation
  is a length check; small-order / all-zero rejection happens on the DH output at the ECDH call sites. A 32-byte SSO shared
  secret is length-indistinguishable from a key, so callers must pass the correct field — the guard is shape, not provenance.
- **`deviceIdentityService`** — the single service object of stateless key helpers: `deriveStatementAccountPublicKey`,
  `deriveEncryptionPublicKey`, `isValidEncryptionPublicKey`.

## Scope

This domain owns:

- **The identity shapes** — the `DeviceIdentity` / `UserIdentity` types that every consumer reconstructs and passes around.
- **Key derivation** — deriving an sr25519 statement-account public key from its seed, and an X25519 encryption public key from
  its private key.
- **Key validation** — `isValidEncryptionPublicKey`, the trust-boundary predicate that rejects malformed encryption keys before
  they reach ECDH (a bad key throws deep in `@noble/curves`, or worse fans out to peers and breaks _their_ sends).

## Deriving and validating keys

Consumers that ingest a peer-supplied encryption key gate it through `deviceIdentityService.isValidEncryptionPublicKey` before
persisting or running ECDH (see `device-sync` and `chat/p2p`).

Rule of thumb: any externally-sourced encryption public key passes `deviceIdentityService.isValidEncryptionPublicKey` before use —
and since that check is shape-only, the caller is still responsible for reading the right field.

## Boundaries

This domain does **not** own:

- **Any key material** — both identities are populated from the TrUAPI core's session, not here.
- **The SSO handshake** that populates a `UserIdentity` — owned by the `sso` domain.
- **Device-sync peers / the `KnownUserDevice` roster** — owned by the `device-sync` domain, which merely _uses_ this domain's
  key validation.
- **Chat/product key wrapping and ECDH transport** — owned by `chat/p2p`; this domain only supplies the derivation/validation
  primitives.

## References

- [`@noble/curves`](https://github.com/paulmillr/noble-curves) — X25519 (`x25519`) key generation and derivation (CHAT-RFC-0004).
- [`@novasamatech/statement-store`](https://www.npmjs.com/package/@novasamatech/statement-store) — canonical sr25519 (`SecretKey::from_bytes`)
  public-key derivation and signing for the statement account.
- [`identity/types.ts`](./identity/types.ts) — the fully-documented `DeviceIdentity` / `UserIdentity` field reference.
