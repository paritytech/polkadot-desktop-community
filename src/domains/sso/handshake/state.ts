/**
 * Handshake V2 state machine — the public-facing observable shape of an
 * in-flight SSO pairing exchange.
 *
 * Maps directly onto the inner `EncryptedHandshakeResponseV2` enum:
 *
 *   Idle       — no proposal emitted yet
 *   Submitted  — proposal QR shown, waiting for the first response statement
 *   Pending    — Mobile acknowledged; allocating Statement Store allowance on-chain
 *   Success    — final state; identity keys received, device authorized
 *   Failed     — final state; PApp rejected (declined / duplicate / no-slot / tx-failed)
 *
 * Transitions are unidirectional except for Failed → Idle (user retries).
 * The state object is what UIs render and what the chat layer gates on
 * before submitting any V2 statements.
 */

import { p256 } from '@noble/curves/nist.js';

import { type DecodedHandshakeResponseV2 } from './codec';

const deriveIdentityChatPublicKey = (privateKey: Uint8Array): Uint8Array => p256.getPublicKey(privateKey, false);

export type HandshakeIdleState = { tag: 'Idle' };
export type HandshakeSubmittedState = { tag: 'Submitted' };
export type HandshakePendingState = { tag: 'Pending'; reason: 'AllowanceAllocation' };
export type HandshakeSuccessState = {
  tag: 'Success';
  identityAccountId: Uint8Array;
  // Nullable: Android `feature/location-for-handshake` ships the v0.2 success
  // body without rootAccountId. The chat layer doesn't need it; product-account
  // soft-derivation does, and gracefully degrades when absent.
  rootAccountId: Uint8Array | null;
  identityChatPrivateKey: Uint8Array;
  identityChatPublicKey: Uint8Array;
  deviceEncPubKey: Uint8Array;
  // `papp_encr_pub` from Mobile SSO spec v0.2.2. Nullable for pre-v0.2.2
  // peers; the SSO session transport stays inactive while null.
  ssoEncPubKey: Uint8Array | null;
};
export type HandshakeFailedState = { tag: 'Failed'; reason: string };

export type HandshakeState =
  | HandshakeIdleState
  | HandshakeSubmittedState
  | HandshakePendingState
  | HandshakeSuccessState
  | HandshakeFailedState;

export const idle = (): HandshakeIdleState => ({ tag: 'Idle' });

export const submitted = (): HandshakeSubmittedState => ({ tag: 'Submitted' });

// Translate the length-dispatched-decoded EncryptedHandshakeResponseV2 into the
// public state. Pure — no I/O. The caller decrypts the outer envelope and
// length-dispatches to `decodeEncryptedHandshakeResponseV2` first.
export const fromInnerResponse = (response: DecodedHandshakeResponseV2): HandshakeState => {
  switch (response.tag) {
    case 'Pending':
      // Only AllowanceAllocation today; widen here when the spec adds more variants.
      return { tag: 'Pending', reason: 'AllowanceAllocation' };
    case 'Success':
      return {
        tag: 'Success',
        identityAccountId: response.value.identityAccountId,
        rootAccountId: response.value.rootAccountId,
        identityChatPrivateKey: response.value.identityChatPrivateKey,
        identityChatPublicKey: deriveIdentityChatPublicKey(response.value.identityChatPrivateKey),
        deviceEncPubKey: response.value.deviceEncPubKey,
        // Local renderer-side decoder hasn't been updated for v0.2.2 yet —
        // host-papp's decoder is the canonical path that surfaces this on
        // `onAuthSuccess`. Onboarding UI only inspects the state tag here.
        ssoEncPubKey: null,
      };
    case 'Failed':
      return { tag: 'Failed', reason: response.value };
  }
};

// Forward-only transition guard: rejects regressions like Success → Pending.
export const advance = (current: HandshakeState, next: HandshakeState): HandshakeState => {
  if (isTerminal(current)) return current;
  if (current.tag === 'Idle' && next.tag !== 'Submitted') return current;
  if (current.tag === 'Submitted' && next.tag === 'Idle') return current;
  return next;
};

export const isTerminal = (state: HandshakeState): state is HandshakeSuccessState | HandshakeFailedState =>
  state.tag === 'Success' || state.tag === 'Failed';

// True only when the device is authorized to submit V2 statements. The
// chat-send path gates on this — V2 messages must wait for allowance.
export const canSubmitV2Statements = (state: HandshakeState): state is HandshakeSuccessState => state.tag === 'Success';
