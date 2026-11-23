/**
 * The identity-level channel with a peer, as a statement-store session.
 *
 * A few chat-content variants are carried between user identities rather than between
 * devices, because the receiver needs them to bootstrap per-device transport in the first
 * place — `deviceChatAccepted` (the acceptor's `DeviceInfo`) and the `deviceAdded` /
 * `deviceRemoved` roster fan-out. Using the per-device session for those is circular.
 *
 *   topic   = SessionId(A, B), listening on SessionId(B, A)
 *   K(A, B) = ECDH(ownIdentityChatPriv, peerIdentityChatPub)
 *
 * Both sides are plain single-device sessions, which is what Android runs here too
 * (`RealContactChatSessionManager` builds an `identitySession` alongside the multi-device
 * `mainSession`). Going through a session rather than one-shot statements means these
 * events are acknowledged and retransmitted until they land, instead of being
 * fire-and-forget.
 */

import { ChatMessage as ChatMessageCodec } from '@novasamatech/host-chat/codec/message';
import {
  type StatementStoreAdapter,
  createAccountId,
  createEncryption,
  createSession,
  createSlotAccountProver,
} from '@novasamatech/statement-store';
import { nanoid } from 'nanoid';
import { type CodecType } from 'scale-ts';

import { p2pService } from './service';
import { chatContentService } from './session-transport/service';
import { type IdentityChannelEvent } from './session-transport/types';

type ChatContent = CodecType<typeof ChatMessageCodec>['versioned']['value'];

export type IdentityChannel = {
  /** Publish an identity-level content variant. Resolves once the session accepts it. */
  post: (content: ChatContent) => Promise<void>;
  dispose: () => void;
};

export const createIdentityChannel = (params: {
  ownIdentityChatPrivateKey: Uint8Array;
  ownIdentityAccountId: Uint8Array;
  peerIdentityChatPublicKey: Uint8Array;
  peerIdentityAccountId: Uint8Array;
  /** This device's canonical sr25519 secret — statements are signed per-device, the identity key never signs. */
  ownDeviceSeed: Uint8Array;
  statementStore: StatementStoreAdapter;
  onEvent: (event: IdentityChannelEvent) => void;
}): IdentityChannel => {
  const {
    ownIdentityChatPrivateKey,
    ownIdentityAccountId,
    peerIdentityChatPublicKey,
    peerIdentityAccountId,
    ownDeviceSeed,
    statementStore,
    onEvent,
  } = params;

  const sharedSecret = p2pService.computeSharedSecret(ownIdentityChatPrivateKey, peerIdentityChatPublicKey);

  const session = createSession({
    localAccount: { accountId: createAccountId(ownIdentityAccountId), pin: undefined },
    remoteAccount: {
      accountId: createAccountId(peerIdentityAccountId),
      publicKey: peerIdentityChatPublicKey,
      pin: undefined,
    },
    statementStore,
    encryption: createEncryption(sharedSecret),
    prover: createSlotAccountProver(ownDeviceSeed),
    // The topic is keyed by the ECDH shared secret, not the raw peer pubkey.
    sessionKey: sharedSecret,
  });

  // Answering is also what opens the store subscription, so every incoming statement is
  // both delivered and acknowledged from here.
  const stopResponding = session.respondToRequests(ChatMessageCodec, request => {
    if (request.payload.status !== 'parsed') return 'decodingFailed';
    for (const event of chatContentService.toIdentityChannelEvents(request.payload.value)) onEvent(event);

    return 'success';
  });

  return {
    post: async content => {
      const payload: CodecType<typeof ChatMessageCodec> = {
        messageId: nanoid(12),
        timestamp: BigInt(Date.now()),
        versioned: { tag: 'v1', value: content },
      };
      const submitted = await session.submitRequestMessage(ChatMessageCodec, payload);
      if (submitted.isErr()) throw submitted.error;
    },
    dispose: () => {
      stopResponding();
      session.dispose();
    },
  };
};
