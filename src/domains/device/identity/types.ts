/**
 * The identity of *this* device — the local instance of Polkadot Desktop on this
 * machine. Owned and persisted by the SDK (host-papp); the app reads it back
 * from the SDK via `@/domains/application` (`loadDeviceIdentity`).
 *
 * Per-device keys (locally generated):
 *   `statementAccountSeed` is the device's expanded sr25519 secret (64 bytes,
 *   derived from 32 bytes of entropy via `createSr25519Secret`). Fed to
 *   `createSr25519Prover` to sign statements as this device.
 *   `statementAccountPublicKey` is the corresponding sr25519 public key (32 bytes)
 *   — this is the device's accountId in the multi-device protocol.
 *
 *   `encryptionPrivateKey` is the device's P-256 private key (32 bytes). Used for
 *   ECDH key wrapping in MultiDeviceRequest envelopes.
 *   `encryptionPublicKey` is the corresponding P-256 public key in 65-byte
 *   uncompressed form, matching the encoding used in `Contact.devices`.
 */
export type DeviceIdentity = {
  statementAccountSeed: Uint8Array;
  statementAccountPublicKey: Uint8Array;
  encryptionPrivateKey: Uint8Array;
  encryptionPublicKey: Uint8Array;
};

/**
 * The user identity associated with this device — populated only after the
 * SSO V2 handshake with PApp completes successfully.
 *
 *   `identityChatPublicKey` is the user's identity chat encryption public key
 *   (65-byte uncompressed P-256). Shared across all of the user's devices.
 *   Derived locally from `identityChatPrivateKey` on handshake success. Used
 *   as the `B` input in V2 topic derivation and for pushId derivation.
 *
 *   `identityChatPrivateKey` is the matching 32-byte raw P-256 scalar,
 *   delivered to this device via the multi-device SSO V2 handshake. Required
 *   to decrypt incoming V2 chat requests addressed to the user identity.
 *
 *   `identitySr25519PublicKey` is the user's primary identity sr25519 (32
 *   bytes). It's the trust root for `DeviceAdded` / `DeviceRemoved` events,
 *   which are signed by the user identity (held only by PApp) so contacts
 *   can verify roster mutations.
 *
 *   `rootSr25519PublicKey` is the user's root sr25519 (32 bytes) used as the
 *   parent for soft-derivation of product accounts. Distinct from
 *   `identitySr25519PublicKey` — products derive from root, chat/identity
 *   addressing uses identity. Both keys must agree across PApp and host so
 *   each side hands a dapp the same address.
 *
 *   `peerDeviceEncPubKey` is the encryption public key of the authorising
 *   PApp device (65 bytes, P-256 uncompressed), read from the SDK session's
 *   `deviceEncPubKey`. Used to ECDH-address the device-sync channel back to
 *   the authorising device. Always present for a V2 session — the handshake
 *   response carries it (sessions persisted before the SDK stored the field
 *   don't decode at all and require a reset / re-pair).
 *
 *   `peerDeviceStatementAccountId` is the statement account (sr25519, 32
 *   bytes) of the authorising PApp device — captured at handshake time as
 *   the signer of PApp's `HandshakeResponseV2` statement. PApp's
 *   `HandshakeSuccessV2` payload itself doesn't carry this account id, so
 *   the renderer pulls it from the statement-store directly. Required to
 *   seed `deviceSyncRepository` with PApp as the first device-sync peer.
 *
 *   `ssoEncPubKey` is `papp_encr_pub` from Mobile SSO spec v0.2.2 — the
 *   P-256 public key of PApp's SSO session encryption keypair. It marks a
 *   v0.2.2-capable peer; nullable because pre-v0.2.2 PApp builds don't ship
 *   the field on the wire. SSO signing/VRF/transaction now run on host-papp's
 *   own `UserSession`, so this field is no longer consumed by the host beyond
 *   recording the peer's capability.
 */
export type UserIdentity = {
  identityChatPublicKey: Uint8Array;
  identityChatPrivateKey: Uint8Array;
  identitySr25519PublicKey: Uint8Array;
  // Nullable: PApp builds that pre-date v0.2.1 ship HandshakeSuccessV2 without
  // a rootAccountId field. Product-account soft-derivation degrades gracefully
  // when absent; chat doesn't touch this.
  rootSr25519PublicKey: Uint8Array | null;
  peerDeviceEncPubKey: Uint8Array;
  peerDeviceStatementAccountId: Uint8Array;
  ssoEncPubKey: Uint8Array | null;
};
