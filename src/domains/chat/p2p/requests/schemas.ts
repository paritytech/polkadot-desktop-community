/**
 * SCALE codecs for the chat request wire format.
 *
 * Must match iOS:
 *   - RemoteChatRequestMessage.swift → RemoteModel, RequestMessage, etc.
 *   - ChatRequestFactory.swift → EncryptedRemoteModel, ProofPayload
 *
 * V2 multi-device extension matches the
 * android `feature/location-for-handshake` decoder
 * (ChatRequestRemoteModel.kt + IdentityProofCodec.kt):
 *
 *   RequestContentV2 {
 *     identityProof:    { identityAccountId(32), proof(32) },
 *     deviceEncPubKey:  Bytes(32),                // sender device X25519 pub
 *     pushToken:        Option<TokenContent>,
 *     welcomeMessage:   Option<RichTextContent>,
 *   }
 *
 * `proof` is `kHash(K(A,B), SCALE(IdentityProofPayload))` where
 *   K(A,B) = ECDH(senderIdentityChatPriv, recipientIdentityChatPub)
 * — a keyed blake2b-256 (kHash) over the identity-binding payload. This
 * replaces the v0.1 one-shot sr25519 `identity_signature`, which is gone in
 * v0.2 (both peers now hold the shared `identity_chat_private_key`, so the
 * receiver can recompute K(B,A) = K(A,B) and verify the kHash).
 *
 * Multi-device topology is not carried inside the request envelope; it's
 * propagated out-of-band via `DeviceAdded`/`DeviceRemoved` roster events
 * (see `multi-device-request.ts`). The request only ships the *sending*
 * device's enc pubkey for the receiver's per-device session bookkeeping.
 *
 * Reuses existing codecs from host-chat and statement-store where possible.
 */

import { RichTextContent, TokenContent } from '@novasamatech/host-chat/codec/message';
import { Bytes, Enum, Option, Struct, Vector, str, u64, u8 } from 'scale-ts';

// ── Primitives ──────────────────────────────────────────────────────────

const AccountIdCodec = Bytes(32);
const PublicKeyCodec = Bytes(32); // X25519 public key (CHAT-RFC-0004)

// ── Request content (versioned) ─────────────────────────────────────────

export const RequestContentV1 = Struct({
  pushToken: Option(TokenContent),
  welcomeMessage: Option(RichTextContent),
});

// Context tag SCALE-encoded into `IdentityProofPayload.context` — binds the
// kHash output to this specific use (chat-request) so the same shared secret
// can't be cross-protocol replayed elsewhere. Must match android's
// `IdentityProofCodec.CHAT_REQUEST_CONTEXT`.
export const IDENTITY_PROOF_CONTEXT = 'mds-chat-request';

// Payload kHash'd into `IdentityProof.proof`. The receiver SCALE-encodes the
// same triple and re-runs kHash(K(B,A), payload) to verify.
export const IdentityProofPayload = Struct({
  identityAccountId: AccountIdCodec,
  statementAccountId: AccountIdCodec,
  context: str,
});

// `proof = kHash(K(A,B), SCALE(IdentityProofPayload))` — 32-byte blake2b-256
// output. Replaces the v0.1 sr25519 `signature` field.
export const IdentityProof = Struct({
  identityAccountId: AccountIdCodec,
  proof: Bytes(32),
});

// RFC 0007 cancel: the proof binds a request id to the identity, keyed by K(A,B) like `IdentityProof`.
export const CANCEL_PROOF_CONTEXT = 'mds-chat-request-cancel';

export const CancelProofPayload = Struct({
  identityAccountId: AccountIdCodec,
  requestId: str,
  context: str,
});

// RFC 0007 cancel content, `VersionedRequestContent` index 2.
const RequestContentCancel = Struct({ identityProof: IdentityProof });

// v0.2 spec layout — must match android's `RequestContentV2` field-for-field.
const RequestContentV2 = Struct({
  identityProof: IdentityProof,
  deviceEncPubKey: PublicKeyCodec,
  pushToken: Option(TokenContent),
  welcomeMessage: Option(RichTextContent),
});

const VersionedRequestContent = Enum({
  v1: RequestContentV1,
  v2: RequestContentV2,
  cancel: RequestContentCancel,
});

const RequestMessage = Struct({
  messageId: str,
  timestamp: u64,
  content: VersionedRequestContent,
});

// ── Proof ───────────────────────────────────────────────────────────────

export const StatementProofCodec = Enum({
  sr25519: Struct({ signature: Bytes(64), signer: Bytes(32) }),
  ed25519: Struct({ signature: Bytes(64), signer: Bytes(32) }),
});

export const ProofPayload = Struct({
  message: RequestMessage,
  requestAcceptorId: Bytes(),
});

// ── Wire format ─────────────────────────────────────────────────────────

export const RemoteModel = Struct({
  message: RequestMessage,
  proof: StatementProofCodec,
});

export const EncryptedRemoteModel = Struct({
  encryptionPubKey: Bytes(),
  encryptedData: Bytes(),
});

// ── Multi-device wire format (V2) ───────────────────────────────────────

// Per-recipient-device entry inside a MultiDeviceRequest/Response.
// `encryptedKey` is the one-shot symmetric key encrypted with a per-device
// AES key derived from ECDH(senderDevicePrivKey, recipientDevicePubKey).
// Only the device matching `statementAccountId` can decrypt.
//
// Matches Android's `@FixedLength(32) val statementAccountId: ByteArray` in
// `RequestDeviceInfo` (paritytech/polkadot-app-android-v2#605). Pre-#605 Android
// APKs emit this as `Vec<u8>` — those builds cannot complete the first
// `DeviceChatAccepted` handshake regardless (chicken-and-egg slot wrap), so we
// match the post-#605 wire and require the Android build to be at #605 head.
const RequestDeviceInfo = Struct({
  statementAccountId: AccountIdCodec,
  encryptedKey: Bytes(),
});

// Outer envelope for a chat request to a multi-device recipient.
// The sender's persistent device encryption pubkey is NOT carried on the
// envelope — receivers look it up in their local `Contact.devices[]`.
// Each `RequestDeviceInfo.encryptedKey` is the one-shot symmetric key
// wrapped via ECDH between the sender's persistent device priv key and
// that recipient device's persistent device pub key.
const MultiDeviceRequest = Struct({
  encryptedRequest: Bytes(),
  devicesInfo: Vector(RequestDeviceInfo),
});

// Mirrors MultiDeviceRequest for the response side.
const MultiDeviceResponse = Struct({
  encryptedResponse: Bytes(),
  devicesInfo: Vector(RequestDeviceInfo),
});

// ── Top-level statement-data dispatcher ─────────────────────────────────
// Mirrors Android's `StructuredStatementData` sealed class:
//   @EnumIndex(0) Request          — V1 single-device
//   @EnumIndex(1) Response         — V1 single-device
//   @EnumIndex(2) MultiRequest     — V2 multi-device
//   @EnumIndex(3) MultiResponse    — V2 multi-device

// Composed into `StructuredStatementData` below; not exported — the enum is the
// only surface callers need.
const SingleRequest = Struct({
  requestId: str,
  messages: Vector(Bytes()),
});

const SingleResponse = Struct({
  requestId: str,
  responseCode: u8,
});

export const StructuredStatementData = Enum({
  Request: SingleRequest,
  Response: SingleResponse,
  MultiRequest: MultiDeviceRequest,
  MultiResponse: MultiDeviceResponse,
});
