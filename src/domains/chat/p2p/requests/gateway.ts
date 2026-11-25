/**
 * V2 chat-request send/receive paths.
 *
 * Shape:
 *   - Topics + envelope: same as V1 (recipient-keyed allPeer + day pair plus
 *     a channel topic; `EncryptedRemoteModel { encryptionPubKey, encryptedData }`
 *     with X25519 against the recipient's identity chat pubkey).
 *   - Inner content: `RequestContentV2` carrying:
 *       * `IdentityProof { identityAccountId, proof }` — `proof` is
 *         `kHash(K(A,B), SCALE(IdentityProofPayload))`, a keyed blake2b-256
 *         where `K(A,B) = ECDH(senderIdentityChatPriv, recipientIdentityChatPub)`.
 *         The receiver recomputes the same kHash and matches bytes.
 *       * `deviceEncPubKey: Bytes(32)` — the **sending** device's X25519
 *         encryption pubkey, used by the recipient as the ECDH counter-party
 *         for V2 multi-device session traffic.
 *   - Inner proof: still signed by the **device sr25519** (proves the
 *     publishing device authored this submission). Identity binding comes
 *     from `IdentityProof.proof` instead of a separate signature.
 *   - Outer Statement Store proof: same device sr25519.
 *   - Cancel (RFC 0007, content index 2): `IdentityProof` over `CancelProofPayload`;
 *     published on the request's channel to replace its copy.
 */

import { x25519 } from '@noble/curves/ed25519.js';
import {
  type StatementStoreAdapter,
  createEncryption,
  createExpiryAllocator,
  deriveSlotAccountPublicKey,
  signSlotAccountSecret,
  verifySr25519Signature,
} from '@novasamatech/statement-store';
import { nanoid } from 'nanoid';
import { toHex } from 'polkadot-api/utils';
import { type CodecType } from 'scale-ts';

import { p2pService } from '../service';
import { transportGateway } from '../session-transport/gateway';
import { trackedSubscribeStatements } from '../subscription-registry';

import { EncryptedRemoteModel, ProofPayload, RemoteModel } from './schemas';
import { chatRequestService } from './service';

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

type RequestMessage = CodecType<typeof RemoteModel>['message'];

// The inner signature only proves the publishing device authored this entry;
// identity binding comes from the content's kHash proof.
function sealRequestMessage(params: {
  message: RequestMessage;
  recipientAccountId: Uint8Array;
  recipientChatPubKey: Uint8Array;
  senderDeviceSeed: Uint8Array;
}): { data: Uint8Array; ephemeralPubKey: Uint8Array; sharedSecret: Uint8Array } {
  const { message, recipientAccountId, recipientChatPubKey, senderDeviceSeed } = params;

  const ephemeralPrivKey = x25519.utils.randomSecretKey();
  const ephemeralPubKey = x25519.getPublicKey(ephemeralPrivKey); // 32 bytes (CHAT-RFC-0004)
  const sharedSecret = p2pService.computeSharedSecret(ephemeralPrivKey, recipientChatPubKey);

  const signature = signSlotAccountSecret(senderDeviceSeed, ProofPayload.enc({ message, requestAcceptorId: recipientAccountId }));
  const remoteModelEncoded = RemoteModel.enc({
    message,
    proof: {
      tag: 'sr25519',
      value: { signature, signer: deriveSlotAccountPublicKey(senderDeviceSeed) },
    },
  });

  const encryptResult = createEncryption(sharedSecret).encrypt(remoteModelEncoded);
  if (encryptResult.isErr()) throw encryptResult.error;

  return {
    data: EncryptedRemoteModel.enc({ encryptionPubKey: ephemeralPubKey, encryptedData: encryptResult.value }),
    ephemeralPubKey,
    sharedSecret,
  };
}

/**
 * Send a V2 chat request to a single recipient.
 *
 * Wire shape matches the v0.2 spec + android `feature/location-for-handshake`:
 * `RequestContentV2 { identityProof, deviceEncPubKey, pushToken, welcomeMessage }`.
 * `senderIdentityChatPrivateKey` is the user-identity chat X25519 private scalar
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

  const currentDay = chatRequestService.getCurrentDay();
  if (!currentDay) throw new Error('Current time is before the chat request epoch');

  // 1. V1 topics keyed on recipient only.
  const allPeerTopic = chatRequestService.computeAllPeerTopic(recipientAccountId);
  const paginationTopic = chatRequestService.computePaginationTopic(recipientAccountId, currentDay.day);

  // 2. Build `IdentityProof.proof = kHash(K(A,B), SCALE(IdentityProofPayload))`.
  //    K(A,B) is the *persistent* ECDH between the sender's identity chat
  //    private key and the recipient's identity chat pubkey (NOT the
  //    ephemeral-key shared secret used for the envelope). The recipient,
  //    holding its own identity chat priv, recomputes the same K and matches.
  const signerPubKey = deriveSlotAccountPublicKey(senderDeviceSeed);
  const identityProofSharedSecret = p2pService.computeSharedSecret(senderIdentityChatPrivateKey, recipientChatPubKey);
  const identityProof = chatRequestService.computeIdentityProof(identityProofSharedSecret, senderIdentityAccountId, signerPubKey);

  // 3. Inner request message — V2 content per v0.2 spec.
  const requestId = nanoid(12);
  const timestamp = BigInt(Date.now());
  const requestMessage: RequestMessage = {
    messageId: requestId,
    timestamp,
    content: {
      tag: 'v2',
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

  // 4. Signed inner message in the V1 envelope, against the recipient's
  //    on-chain user chat pubkey.
  const sealed = sealRequestMessage({ message: requestMessage, recipientAccountId, recipientChatPubKey, senderDeviceSeed });

  // 5. Channel topic for accept-signal monitoring.
  const channelTopic = chatRequestService.computeChannelTopic(sealed.ephemeralPubKey, sealed.sharedSecret);

  // 6. Outer Statement Store proof signed by the same device sr25519.
  await transportGateway.signAndSubmitStatement({
    signerSeed: senderDeviceSeed,
    statementStore,
    channel: channelTopic,
    topics: [allPeerTopic, paginationTopic, channelTopic],
    data: sealed.data,
    logTag: 'chat-request-v2 send',
  });

  return { requestId, channelTopic };
};

/**
 * Publish an RFC 0007 cancel for an outgoing request. The cancel replaces the
 * request's copy on the request channel because it shares the copy's account
 * and channel with a higher expiry, `max(copy expiry + 1, timestamp priority)`
 * (RFC 0007 § Sending). Resolves `'noCopy'` and publishes nothing when this
 * device's copy is no longer on the channel (RFC 0007 § Sending, step 4).
 */
async function sendChatRequestCancel(params: {
  requestId: string;
  requestTimestamp: number;
  channelTopic: Uint8Array;
  recipientAccountId: Uint8Array;
  recipientChatPubKey: Uint8Array;
  senderIdentityAccountId: Uint8Array;
  senderIdentityChatPrivateKey: Uint8Array;
  senderDeviceSeed: Uint8Array;
  statementStore: StatementStoreAdapter;
}): Promise<'published' | 'noCopy'> {
  const {
    requestId,
    requestTimestamp,
    channelTopic,
    recipientAccountId,
    recipientChatPubKey,
    senderIdentityAccountId,
    senderIdentityChatPrivateKey,
    senderDeviceSeed,
    statementStore,
  } = params;

  const queried = await statementStore.queryStatements({ matchAll: [channelTopic] });
  if (queried.isErr()) throw queried.error;

  const ownSigner = toHex(deriveSlotAccountPublicKey(senderDeviceSeed));
  const ownCopies = queried.value.filter(
    statement => statement.proof?.type === 'sr25519' && statement.proof.value.signer.toLowerCase() === ownSigner,
  );
  if (ownCopies.length === 0) return 'noCopy';

  const cancelMessage: RequestMessage = {
    messageId: requestId,
    timestamp: BigInt(Math.max(Date.now(), requestTimestamp + 1)),
    content: {
      tag: 'cancel',
      value: {
        identityProof: {
          identityAccountId: senderIdentityAccountId,
          proof: chatRequestService.computeCancelProof(
            p2pService.computeSharedSecret(senderIdentityChatPrivateKey, recipientChatPubKey),
            senderIdentityAccountId,
            requestId,
          ),
        },
      },
    },
  };
  const sealed = sealRequestMessage({ message: cancelMessage, recipientAccountId, recipientChatPubKey, senderDeviceSeed });

  const currentDay = chatRequestService.getCurrentDay();
  if (!currentDay) throw new Error('Current time is before the chat request epoch');

  const allocator = createExpiryAllocator();
  let copyExpiry = 0n;
  for (const copy of ownCopies) {
    if (copy.expiry !== undefined && copy.expiry > copyExpiry) copyExpiry = copy.expiry;
  }
  allocator.raiseFloor(copyExpiry);

  await transportGateway.signAndSubmitStatement({
    signerSeed: senderDeviceSeed,
    statementStore,
    channel: channelTopic,
    topics: [
      chatRequestService.computeAllPeerTopic(recipientAccountId),
      chatRequestService.computePaginationTopic(recipientAccountId, currentDay.day),
      channelTopic,
    ],
    data: sealed.data,
    allocator,
    logTag: 'chat-request-cancel send',
  });

  return 'published';
}

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
  /** X25519 (32 bytes) — sender device's encryption pubkey (RequestContentV2.deviceEncPubKey). */
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
 * An incoming RFC 0007 cancel whose inner signature verified. `identityProof`
 * is still unchecked: it is keyed by K(A,B), which the decoder does not hold.
 */
export type ValidatedRequestCancel = {
  requestId: string;
  timestamp: number;
  senderIdentityAccountId: Uint8Array;
  identityProof: Uint8Array;
};

export type DecodedRequestStatement =
  { tag: 'request'; value: ValidatedRequest | ValidatedRequestV2 } | { tag: 'cancel'; value: ValidatedRequestCancel };

export type IncomingRequestHandlers = {
  onRequest: (request: ValidatedRequest | ValidatedRequestV2) => void;
  onCancel: (cancel: ValidatedRequestCancel) => void;
};

/**
 * Decrypt + validate an incoming chat request statement. Handles V1 (legacy),
 * V2 and cancel inner content: a request decodes to `{ tag: 'request' }` with
 * the V1 `ValidatedRequest` or the extended `ValidatedRequestV2` shape, a
 * cancel to `{ tag: 'cancel' }`.
 *
 * The inner signature is checked for every content against `ownAccountId`, the
 * `requestAcceptorId` it covers; a statement that fails it decodes to `null`.
 *
 * `ownChatPrivateKey` is the recipient's user chat X25519 private key
 * (V1-derived from the wallet ssSecret). On desktop after V2 SSO this is
 * **not available**, so this function will fail to decrypt V2 chat requests
 * sent to the user chat key. The caller is expected to handle the null
 * return as "couldn't decrypt this one — skip".
 */
const decryptAndValidateRequestV2 = (
  statementData: Uint8Array,
  ownChatPrivateKey: Uint8Array,
  ownAccountId: Uint8Array,
): DecodedRequestStatement | null => {
  try {
    const encrypted = EncryptedRemoteModel.dec(statementData);

    const sharedSecret = p2pService.computeSharedSecret(ownChatPrivateKey, encrypted.encryptionPubKey);
    const encryption = createEncryption(sharedSecret);

    const decryptResult = encryption.decrypt(encrypted.encryptedData);
    if (decryptResult.isErr()) {
      // Expected on V2 requests when desktop lacks the user chat private key.
      const ownPub = x25519.getPublicKey(ownChatPrivateKey);
      console.warn(
        '[chat-request-v2] outer decrypt failed (recipient lacks identity chat priv key, or wrong key): %s. ownChatPubKey=%s sender ephemeralPubKey=%s',
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

    const signed = ProofPayload.enc({ message: remote.message, requestAcceptorId: ownAccountId });
    if (!verifySr25519Signature(signed, remote.proof.value.signature, remote.proof.value.signer)) {
      console.warn('[chat-request-v2] inner signature invalid');
      return null;
    }

    const content = remote.message.content;

    if (content.tag === 'cancel') {
      return {
        tag: 'cancel',
        value: {
          requestId: remote.message.messageId,
          timestamp: Number(remote.message.timestamp),
          senderIdentityAccountId: content.value.identityProof.identityAccountId,
          identityProof: content.value.identityProof.proof,
        },
      };
    }

    // Channel topic is deterministic from (ephemeralPubKey, sharedSecret) —
    // both peers can derive it locally. Don't rely on the outer `stmt.channel`
    // field: the sender's adapter may not propagate it (android currently
    // omits it on the wire), and that would leave us unable to post the
    // accept signal back on the agreed channel.
    const channelTopic = toHex(chatRequestService.computeChannelTopic(encrypted.encryptionPubKey, sharedSecret));

    const base: ValidatedRequest = {
      requestId: remote.message.messageId,
      senderAccountId: remote.proof.value.signer,
      welcomeMessage: undefined,
      timestamp: Number(remote.message.timestamp),
      channelTopic,
      pushToken: undefined,
      pushPlatform: undefined,
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
      return { tag: 'request', value: base };
    }

    // V2 content: identity acct goes onto senderAccountId so contact
    // resolution lands on the user, not the publishing device. The device
    // sr25519 stays available on `senderDeviceStatementAccountId` for the
    // caller's per-device roster (Contact.devices[]). The identity proof is
    // checked by the manager's `addIncomingRequest`, which holds the
    // receiver's identity chat key and the resolver.
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
      tag: 'request',
      value: {
        ...base,
        senderAccountId: content.value.identityProof.identityAccountId,
        senderIdentityAccountId: content.value.identityProof.identityAccountId,
        senderIdentityProof: content.value.identityProof.proof,
        senderDevicePubKey: content.value.deviceEncPubKey,
        senderDeviceStatementAccountId: remote.proof.value.signer,
      },
    };
  } catch (e) {
    console.warn('[chat-request-v2] Failed to process request:', e);
    return null;
  }
};

/**
 * Subscribe to incoming V1 + V2 chat requests and cancels on the current day's
 * pagination topic for our user identity sr25519. Mirrors V1
 * `subscribeToIncomingRequests` but routes through the V2 decoder.
 */
const subscribeToIncomingRequestsV2 = (
  params: {
    ownAccountId: Uint8Array;
    ownChatPrivateKey: Uint8Array;
    statementStore: StatementStoreAdapter;
  },
  handlers: IncomingRequestHandlers,
): VoidFunction => {
  const { ownAccountId, ownChatPrivateKey, statementStore } = params;

  const currentDay = chatRequestService.getCurrentDay();
  if (!currentDay) return () => {};

  const paginationTopic = chatRequestService.computePaginationTopic(ownAccountId, currentDay.day);

  // V1-shape pagination topic (recipient-only) — what desktop currently
  // publishes on. Subscribing here catches both desktop and (if android
  // is also publishing on V1-shape topics) android.
  const unsubV1 = trackedSubscribeStatements(statementStore, { matchAll: [paginationTopic] }, ({ statements }) => {
    for (const stmt of statements) {
      if (!stmt.data) continue;
      const decoded = decryptAndValidateRequestV2(stmt.data, ownChatPrivateKey, ownAccountId);
      if (!decoded) continue;
      if (decoded.tag === 'request') handlers.onRequest(decoded.value);
      else handlers.onCancel(decoded.value);
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
  sendChatRequestCancel,
  decryptAndValidateRequestV2,
  subscribeToIncomingRequestsV2,
};
