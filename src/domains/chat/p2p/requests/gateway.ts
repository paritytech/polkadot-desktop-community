/**
 * V2 chat-request send/receive paths.
 *
 * Shape:
 *   - Topics + envelope: same as V1 (recipient-keyed allPeer + day pair plus
 *     a channel topic; `EncryptedRemoteModel { encryptionPubKey, encryptedData }`
 *     with ECDH against the recipient's identity chat P-256 pubkey).
 *   - Inner content: `RequestContentV2` carrying:
 *       * `IdentityProof { identityAccountId, proof }` — `proof` is
 *         `kHash(K(A,B), SCALE(IdentityProofPayload))`, a keyed blake2b-256
 *         where `K(A,B) = ECDH(senderIdentityChatPriv, recipientIdentityChatPub)`.
 *         The receiver recomputes the same kHash and matches bytes.
 *       * `deviceEncPubKey: Bytes(65)` — the **sending** device's P-256
 *         encryption pubkey, used by the recipient as the ECDH counter-party
 *         for V2 multi-device session traffic.
 *   - Inner proof: still signed by the **device sr25519** (proves the
 *     publishing device authored this submission). Identity binding comes
 *     from `IdentityProof.proof` instead of a separate signature.
 *   - Outer Statement Store proof: same device sr25519.
 */

import { p256 } from '@noble/curves/nist.js';
import {
  type StatementStoreAdapter,
  createEncryption,
  deriveSr25519PublicKey,
  khash,
  signWithSr25519Secret,
} from '@novasamatech/statement-store';
import { nanoid } from 'nanoid';
import { toHex } from 'polkadot-api/utils';

import { p2pService } from '../service';
import { transportGateway } from '../session-transport/gateway';
import { trackedSubscribeStatements } from '../subscription-registry';

import { EncryptedRemoteModel, IDENTITY_PROOF_CONTEXT, IdentityProofPayload, ProofPayload, RemoteModel } from './schemas';
import { chatRequestTopicService } from './service';

/**
 * Shape returned for legacy V1-wire chat requests. V2 wire decodes extend this
 * via `ValidatedRequestV2`. Inlined here (rather than in `types.ts`) because
 * the V2 chat-request decoder is the only place that emits or consumes the
 * legacy shape after the V1 manager was removed.
 */
export type ValidatedRequest = {
  requestId: string;
  senderAccountId: Uint8Array;
  welcomeMessage?: string;
  timestamp: number;
  channelTopic?: string;
  pushToken?: string;
  pushPlatform?: 'Android' | 'iOS';
};

// ── Send ───────────────────────────────────────────────────────────────────

/**
 * Send a V2 chat request to a single recipient.
 *
 * Wire shape matches the v0.2 spec + android `feature/location-for-handshake`:
 * `RequestContentV2 { identityProof, deviceEncPubKey, pushToken, welcomeMessage }`.
 * `senderIdentityChatPrivateKey` is the user-identity chat P-256 private scalar
 * delivered by the SSO V2 handshake; combined with the recipient's identity
 * chat pubkey it derives the shared secret `K(A,B)` that keys the kHash proof.
 */
const sendChatRequestV2 = async (params: {
  recipientAccountId: Uint8Array;
  recipientChatPubKey: Uint8Array;
  senderIdentityAccountId: Uint8Array;
  senderIdentityChatPrivateKey: Uint8Array;
  senderDevicePubKey: Uint8Array;
  senderDeviceSeed: Uint8Array;
  welcomeMessage?: string;
  statementStore: StatementStoreAdapter;
}): Promise<{ requestId: string; channelTopic: Uint8Array }> => {
  const {
    recipientAccountId,
    recipientChatPubKey,
    senderIdentityAccountId,
    senderIdentityChatPrivateKey,
    senderDevicePubKey,
    senderDeviceSeed,
    welcomeMessage,
    statementStore,
  } = params;

  const currentDay = chatRequestTopicService.getCurrentDay();
  if (!currentDay) throw new Error('Current time is before the chat request epoch');

  // 1. V1 topics keyed on recipient only.
  const allPeerTopic = chatRequestTopicService.computeAllPeerTopic(recipientAccountId);
  const paginationTopic = chatRequestTopicService.computePaginationTopic(recipientAccountId, currentDay.day);

  // 2. Ephemeral P-256 ECDH for envelope encryption against the recipient's
  //    on-chain user chat pubkey — same shape as V1.
  const ephemeralPrivKey = p256.utils.randomSecretKey();
  const ephemeralPubKey = p256.getPublicKey(ephemeralPrivKey, false); // 65 bytes uncompressed
  const sharedSecret = p2pService.computeSharedSecret(ephemeralPrivKey, recipientChatPubKey);
  const encryption = createEncryption(sharedSecret);

  // 3. Channel topic for accept-signal monitoring.
  const channelTopic = chatRequestTopicService.computeChannelTopic(ephemeralPubKey, sharedSecret);

  // 4. Build `IdentityProof.proof = kHash(K(A,B), SCALE(IdentityProofPayload))`.
  //    K(A,B) is the *persistent* ECDH between the sender's identity chat
  //    private key and the recipient's identity chat pubkey (NOT the
  //    ephemeral-key shared secret used for the envelope). The recipient,
  //    holding its own identity chat priv, recomputes the same K and matches.
  const signerPubKey = deriveSr25519PublicKey(senderDeviceSeed);
  const identityProofSharedSecret = p2pService.computeSharedSecret(senderIdentityChatPrivateKey, recipientChatPubKey);
  const identityProofPayload = IdentityProofPayload.enc({
    identityAccountId: senderIdentityAccountId,
    statementAccountId: signerPubKey,
    context: IDENTITY_PROOF_CONTEXT,
  });
  const identityProof = khash(identityProofSharedSecret, identityProofPayload);

  // 5. Inner request message — V2 content per v0.2 spec.
  const requestId = nanoid(12);
  const timestamp = BigInt(Date.now());
  const requestMessage = {
    messageId: requestId,
    timestamp,
    content: {
      tag: 'v2' as const,
      value: {
        identityProof: {
          identityAccountId: senderIdentityAccountId,
          proof: identityProof,
        },
        deviceEncPubKey: senderDevicePubKey,
        pushToken: undefined,
        welcomeMessage: welcomeMessage ? { text: welcomeMessage, attachments: undefined } : undefined,
      },
    },
  };

  // 6. Inner proof signed by the device sr25519. Identity binding comes
  //    from the kHash `identityProof.proof` field above; this signature just
  //    proves the publishing device authored *this* statement-store entry.
  const proofPayloadEncoded = ProofPayload.enc({
    message: requestMessage,
    requestAcceptorId: recipientAccountId,
  });
  const signature = signWithSr25519Secret(senderDeviceSeed, proofPayloadEncoded);

  // 7. RemoteModel + V1 envelope encryption.
  const remoteModelEncoded = RemoteModel.enc({
    message: requestMessage,
    proof: {
      tag: 'sr25519',
      value: { signature, signer: signerPubKey },
    },
  });

  const encryptResult = encryption.encrypt(remoteModelEncoded);
  if (encryptResult.isErr()) throw encryptResult.error;

  const encryptedRemoteModel = {
    encryptionPubKey: ephemeralPubKey,
    encryptedData: encryptResult.value,
  };
  const outerPayload = EncryptedRemoteModel.enc(encryptedRemoteModel);

  // 8. Outer Statement Store proof signed by the same device sr25519.
  await transportGateway.signAndSubmitStatement({
    signerSeed: senderDeviceSeed,
    statementStore,
    channel: channelTopic,
    topics: [allPeerTopic, paginationTopic, channelTopic],
    data: outerPayload,
    logTag: 'chat-request-v2 send',
  });

  return { requestId, channelTopic };
};

// ── Receive ────────────────────────────────────────────────────────────────

/**
 * Result of decrypting + validating an incoming V2 chat request. Surfaces the
 * sender's identity acct + per-device encryption pubkey so the recipient can
 * persist them (Contact.devices[]) and address the sender device for V2
 * multi-device session traffic.
 */
export type ValidatedRequestV2 = ValidatedRequest & {
  senderIdentityAccountId: Uint8Array;
  /** kHash(K(A,B), SCALE(IdentityProofPayload)) — 32 bytes. */
  senderIdentityProof: Uint8Array;
  /** P-256 (65 bytes) — sender device's encryption pubkey (RequestContentV2.deviceEncPubKey). */
  senderDevicePubKey: Uint8Array;
  /**
   * sr25519 (32 bytes) — sender device's statementAccountId. Taken from
   * `RemoteModel.proof.signer` and forced to equal the device sr25519 by
   * IdentityProofPayload verification (which hashes `statementAccountId =
   * proof.signer` against K(A,B); verification fails otherwise).
   */
  senderDeviceStatementAccountId: Uint8Array;
};

/**
 * Decrypt + validate an incoming chat request. Handles both V1 (legacy) and V2
 * inner content; returns the V1 `ValidatedRequest` shape for V1 messages and
 * the extended `ValidatedRequestV2` shape for V2 messages.
 *
 * `ownChatP256PrivateKey` is the recipient's user chat P-256 private key
 * (V1-derived from the wallet ssSecret). On desktop after V2 SSO this is
 * **not available**, so this function will fail to decrypt V2 chat requests
 * sent to the user chat key. The caller is expected to handle the null
 * return as "couldn't decrypt this one — skip".
 */
const decryptAndValidateRequestV2 = (
  statementData: Uint8Array,
  ownChatP256PrivateKey: Uint8Array,
): ValidatedRequest | ValidatedRequestV2 | null => {
  try {
    const encrypted = EncryptedRemoteModel.dec(statementData);

    const sharedSecret = p2pService.computeSharedSecret(ownChatP256PrivateKey, encrypted.encryptionPubKey);
    const encryption = createEncryption(sharedSecret);

    const decryptResult = encryption.decrypt(encrypted.encryptedData);
    if (decryptResult.isErr()) {
      // Expected on V2 requests when desktop lacks user chat P-256 private key.
      const ownPub = p256.getPublicKey(ownChatP256PrivateKey, false);
      console.warn(
        '[chat-request-v2] outer decrypt failed (recipient lacks identity chat priv key, or wrong key): %s. ownChatP256PubKey=%s sender ephemeralPubKey=%s',
        String(decryptResult.error),
        toHex(ownPub),
        toHex(encrypted.encryptionPubKey),
      );
      return null;
    }

    let remote: ReturnType<typeof RemoteModel.dec>;
    try {
      remote = RemoteModel.dec(decryptResult.value);
    } catch (decodeErr) {
      // Inner SCALE decode failure — dump the plaintext bytes so we can
      // diff against android's byte layout. Outer decrypt already succeeded
      // (we're the correct recipient), so this means a wire-shape mismatch.
      console.warn(
        '[chat-request-v2] inner RemoteModel decode failed; plaintext (%db) = %s',
        decryptResult.value.length,
        toHex(decryptResult.value),
      );
      throw decodeErr;
    }

    if (remote.proof.tag !== 'sr25519') {
      console.warn('[chat-request-v2] Unsupported proof type:', remote.proof.tag);
      return null;
    }

    const content = remote.message.content;
    let welcomeMessage: string | undefined;
    let pushToken: string | undefined;
    let pushPlatform: 'Android' | 'iOS' | undefined;

    // Channel topic is deterministic from (ephemeralPubKey, sharedSecret) —
    // both peers can derive it locally. Don't rely on the outer `stmt.channel`
    // field: the sender's adapter may not propagate it (android currently
    // omits it on the wire), and that would leave us unable to post the
    // accept signal back on the agreed channel.
    const channelTopic = toHex(chatRequestTopicService.computeChannelTopic(encrypted.encryptionPubKey, sharedSecret));

    const base: ValidatedRequest = {
      requestId: remote.message.messageId,
      senderAccountId: remote.proof.value.signer,
      welcomeMessage,
      timestamp: Number(remote.message.timestamp),
      channelTopic,
      pushToken,
      pushPlatform,
    };

    if (content.tag === 'v1') {
      if (content.value.welcomeMessage) base.welcomeMessage = content.value.welcomeMessage.text;
      if (content.value.pushToken) {
        const platform = content.value.pushToken.platform;
        // iOSVoIP tokens are CallKit-only — drop here since desktop can't initiate calls
        // and the downstream push-sender only understands 'Android' | 'iOS'.
        if (platform === 'Android' || platform === 'iOS') {
          base.pushToken =
            typeof content.value.pushToken.token === 'string' ? content.value.pushToken.token.replace(/^0x/, '') : undefined;
          base.pushPlatform = platform;
        }
      }
      return base;
    }

    // V2 content: identity acct goes onto senderAccountId so contact
    // resolution lands on the user, not the publishing device. The device
    // sr25519 stays available on `senderDeviceStatementAccountId` for the
    // caller's per-device roster (Contact.devices[]). Identity-proof
    // verification (kHash(K(B,A), SCALE(IdentityProofPayload)) == received
    // proof) requires the recipient's identityChatPrivateKey, which the
    // caller has but this decoder doesn't, so verification lives in the
    // subscriber callback that owns those keys.
    if (content.value.welcomeMessage) base.welcomeMessage = content.value.welcomeMessage.text;
    if (content.value.pushToken) {
      const platform = content.value.pushToken.platform;
      // iOSVoIP tokens are CallKit-only — drop here since desktop can't initiate calls
      // and the downstream push-sender only understands 'Android' | 'iOS'.
      if (platform === 'Android' || platform === 'iOS') {
        base.pushToken =
          typeof content.value.pushToken.token === 'string' ? content.value.pushToken.token.replace(/^0x/, '') : undefined;
        base.pushPlatform = platform;
      }
    }

    return {
      ...base,
      senderAccountId: content.value.identityProof.identityAccountId,
      senderIdentityAccountId: content.value.identityProof.identityAccountId,
      senderIdentityProof: content.value.identityProof.proof,
      senderDevicePubKey: content.value.deviceEncPubKey,
      senderDeviceStatementAccountId: remote.proof.value.signer,
    };
  } catch (e) {
    console.warn('[chat-request-v2] Failed to process request:', e);
    return null;
  }
};

/**
 * Subscribe to incoming V1 + V2 chat requests on the current day's pagination
 * topic for our user identity sr25519. Mirrors V1 `subscribeToIncomingRequests`
 * but routes through the V2 decoder.
 */
const subscribeToIncomingRequestsV2 = (
  params: {
    ownAccountId: Uint8Array;
    ownChatP256PrivateKey: Uint8Array;
    statementStore: StatementStoreAdapter;
  },
  callback: (request: ValidatedRequest | ValidatedRequestV2) => void,
): VoidFunction => {
  const { ownAccountId, ownChatP256PrivateKey, statementStore } = params;

  const currentDay = chatRequestTopicService.getCurrentDay();
  if (!currentDay) return () => {};

  const paginationTopic = chatRequestTopicService.computePaginationTopic(ownAccountId, currentDay.day);

  // V1-shape pagination topic (recipient-only) — what desktop currently
  // publishes on. Subscribing here catches both desktop and (if android
  // is also publishing on V1-shape topics) android.
  const unsubV1 = trackedSubscribeStatements(statementStore, { matchAll: [paginationTopic] }, ({ statements }) => {
    for (const stmt of statements) {
      if (!stmt.data) continue;
      const validated = decryptAndValidateRequestV2(stmt.data, ownChatP256PrivateKey);
      if (validated) callback(validated);
    }
  });

  // V2-shape pagination topic (per chatRequestTopicsV2 spec, keyed on
  // senderDevice + recipientUser). Without knowing peer device IDs ahead
  // of time, subscribe per known peer device via the debug helper. This
  // path catches android if it publishes on V2 spec topics.
  // If user runs window.__p2pV2Debug.armV2Probe(senderDeviceAcctIdHex)
  // we'll add a subscription on the matching V2 topic for that day.

  return () => {
    unsubV1();
  };
};

export const chatRequestGateway = {
  sendChatRequestV2,
  decryptAndValidateRequestV2,
  subscribeToIncomingRequestsV2,
};
