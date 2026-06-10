/**
 * SCALE codecs for the Polkadot mobile SSO handshake (V2, multi-device shape).
 *
 * Flow: Polkadot Desktop (the Host) emits a `VersionedHandshakeProposal::V2`
 * via QR code carrying its `Device { statementAccountId, encryptionPublicKey }`
 * and metadata. The PApp responds over the Statement Store with a
 * `VersionedHandshakeResponse`, the body of which is encrypted via ECDH
 * between the Host's `sharedSecretPublicKey` and Mobile's ephemeral `tmpKey`.
 * After decrypt the inner payload is `EncryptedHandshakeResponseV2 = Pending |
 * Success | Failed`.
 *
 * `Success` carries the user identity sr25519 accountId (32 bytes), the user
 * root sr25519 accountId (32 bytes — the parent for soft-derivation of
 * product accounts; PApp and host must derive identically), the user identity
 * chat P-256 private scalar (32 bytes), and the encryption public key of the
 * authorising PApp device (65 bytes, P-256 uncompressed). Total 161 bytes.
 * Multi-device authorisation is asserted via roster events
 * (`DeviceAdded`/`DeviceRemoved`), not via a per-handshake signature.
 *
 * V1 codecs are kept so we can decode legacy responses from older mobile
 * builds; only V2 is emitted.
 */

import { Bytes, Enum, Struct, Tuple, Vector, _void, str } from 'scale-ts';

// ── Primitives ──────────────────────────────────────────────────────────

const AccountIdCodec = Bytes(32);
const PublicKeyCodec = Bytes(65);
const PrivateKeyCodec = Bytes(32);

// ── Proposal ────────────────────────────────────────────────────────────

export const MetadataKey = Enum({
  Custom: str,
  HostName: _void,
  HostVersion: _void,
  HostIcon: _void,
  PlatformType: _void,
  PlatformVersion: _void,
});

export const MetadataEntry = Tuple(MetadataKey, str);

export const Device = Struct({
  statementAccountId: AccountIdCodec,
  encryptionPublicKey: PublicKeyCodec,
});

export const HandshakeProposalV2 = Struct({
  device: Device,
  metadata: Vector(MetadataEntry),
});

export const VersionedHandshakeProposal = Enum({
  V2: HandshakeProposalV2,
});

// ── Response (V1, kept for decoding legacy mobile clients) ──────────────

export const EncryptedHandshakeResponseV1 = Struct({
  encryptionKey: PublicKeyCodec,
  accountId: AccountIdCodec,
});

export const HandshakeResponseV1 = Struct({
  encrypted: Bytes(),
  tmpKey: PublicKeyCodec,
});

// ── Response (V2) ───────────────────────────────────────────────────────

/** 32 + 32 + 32 + 65 = 161 bytes — spec v0.2.1 (2026-05-07). */
export const HandshakeSuccessV2 = Struct({
  identityAccountId: AccountIdCodec,
  rootAccountId: AccountIdCodec,
  identityChatPrivateKey: PrivateKeyCodec,
  deviceEncPubKey: PublicKeyCodec,
});

/**
 * 32 + 32 + 65 = 129 bytes — spec v0.2 (2026-05-06). Shipped by Android
 * builds before they add `rootAccountId`. Currently `feature/location-for-handshake`
 * is on this shape. Decoded via `decodeEncryptedHandshakeResponseV2` length
 * dispatch; surfaces `rootAccountId: null` to consumers.
 */
export const HandshakeSuccessV2Legacy = Struct({
  identityAccountId: AccountIdCodec,
  identityChatPrivateKey: PrivateKeyCodec,
  deviceEncPubKey: PublicKeyCodec,
});

export const HandshakeStatusV2 = Enum({
  AllowanceAllocation: _void,
});

export const EncryptedHandshakeResponseV2 = Enum({
  Pending: HandshakeStatusV2,
  Success: HandshakeSuccessV2,
  Failed: str,
});

export type HandshakeSuccessV2Decoded = {
  identityAccountId: Uint8Array;
  rootAccountId: Uint8Array | null;
  identityChatPrivateKey: Uint8Array;
  deviceEncPubKey: Uint8Array;
};

export type DecodedHandshakeResponseV2 =
  | { tag: 'Pending'; value: { tag: 'AllowanceAllocation'; value: undefined } }
  | { tag: 'Success'; value: HandshakeSuccessV2Decoded }
  | { tag: 'Failed'; value: string };

/**
 * Length-dispatched decoder for the inner `EncryptedHandshakeResponseV2`
 * plaintext (post envelope-decrypt). The peer's `Success` body size depends
 * on which spec revision its build implements:
 *
 *   - v0.2 (Android `feature/location-for-handshake`): 128B without
 *     `rootAccountId`.
 *   - v0.2.1: 161B with `rootAccountId`.
 *
 * The chat layer doesn't need `rootAccountId` (it's for product-account
 * soft-derivation only — see HackMD spec § Glossary), so we accept both
 * shapes and surface `rootAccountId: null` for the legacy case.
 */
export const decodeEncryptedHandshakeResponseV2 = (bytes: Uint8Array): DecodedHandshakeResponseV2 => {
  if (bytes.length === 0) throw new Error('EncryptedHandshakeResponseV2: empty plaintext');
  const tag = bytes[0];
  // `slice` (not `subarray`) — scale-ts decoders read from buffer byteOffset 0
  // and ignore the view offset, so a `subarray(1)` view would give back the
  // tag byte as the first field of the inner struct. Use `slice` to copy into
  // a fresh buffer that starts at byteOffset 0.
  const body = bytes.slice(1);

  if (tag === 0) {
    if (body.length === 0) throw new Error('EncryptedHandshakeResponseV2: Pending body empty');
    return { tag: 'Pending', value: { tag: 'AllowanceAllocation', value: undefined } };
  }

  if (tag === 1) {
    if (body.length === 161) {
      const decoded = HandshakeSuccessV2.dec(body);
      return {
        tag: 'Success',
        value: {
          identityAccountId: decoded.identityAccountId,
          rootAccountId: decoded.rootAccountId,
          identityChatPrivateKey: decoded.identityChatPrivateKey,
          deviceEncPubKey: decoded.deviceEncPubKey,
        },
      };
    }
    if (body.length === 129) {
      const decoded = HandshakeSuccessV2Legacy.dec(body);
      return {
        tag: 'Success',
        value: {
          identityAccountId: decoded.identityAccountId,
          rootAccountId: null,
          identityChatPrivateKey: decoded.identityChatPrivateKey,
          deviceEncPubKey: decoded.deviceEncPubKey,
        },
      };
    }
    throw new Error(`EncryptedHandshakeResponseV2: Success body length ${body.length} not in {129, 161}`);
  }

  if (tag === 2) {
    return { tag: 'Failed', value: str.dec(body) };
  }

  throw new Error(`EncryptedHandshakeResponseV2: unknown variant tag ${tag}`);
};

export const HandshakeResponseV2 = Struct({
  encrypted: Bytes(),
  tmpKey: PublicKeyCodec,
});

export const VersionedHandshakeResponse = Enum({
  V1: HandshakeResponseV1,
  V2: HandshakeResponseV2,
});
