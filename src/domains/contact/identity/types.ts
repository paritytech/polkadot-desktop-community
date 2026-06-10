/**
 * A single device registered against a user identity.
 *
 * `statementAccountId` is the device's sr25519 public key (32 bytes, hex).
 * `encryptionPublicKey` is the device's P-256 uncompressed public key (65 bytes, hex)
 * used for ECDH-derived per-device key wrapping in MultiDeviceRequest envelopes.
 */
export type Device = {
  statementAccountId: string;
  encryptionPublicKey: string;
};

/**
 * A contact's public identity. Mirrors the user-level identity, not a per-device
 * session — chat session state stays in `P2PRoom` and is keyed off `accountId`.
 *
 * `identityChatPublicKey` is shared across all the contact's devices (used for
 * topic derivation). `devices` is populated lazily as DeviceAdded/DeviceRemoved
 * messages arrive; an empty list means the contact is on the legacy single-device
 * protocol and we must fall back to the old Request/Response format.
 */
export type Contact = {
  accountId: string;
  identityChatPublicKey: string;
  devices: Device[];
  lastUpdate: number; // ms since epoch — required for sync, set on every upsert
};
