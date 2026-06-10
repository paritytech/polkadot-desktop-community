import { type MessageContent as MessageContentCodec } from '@novasamatech/host-chat/codec/message';
import { type CodecType } from 'scale-ts';

import { type MessageContent } from '../session/types';

import { type OutboxRecord } from './schemas';

// P2P chat uses SS58 strings for peer identification (matching polkadot-web),
// not the branded hex AccountId type used elsewhere in polkadot-desktop.

export type P2PPeer = {
  type: 'p2p';
  accountId: string;
  name: string;
};

export type P2PRoom = {
  sessionId: string;
  peerId: string;
  peerUsername: string;
  peerP256PublicKey: string;
  userId: string;
  createdAt: number;
  peerPushToken?: string;
  peerPlatform?: 'Android' | 'iOS';
  // Mirrors Android's Contact.isBlocked. Optional + defaulted to false so existing
  // Dexie rows from before this field was added decode as unblocked without a
  // schema bump (the field is not indexed).
  isBlocked?: boolean;
  lastUpdate: number;
};

export type P2PChatRequest = {
  requestId: string;
  peerId: string;
  peerUsername?: string;
  direction: 'incoming' | 'outgoing';
  // 'removed' is a tombstone written by `removeSession` so a stale on-chain
  // request can't resurface after the user wipes a chat. UI lists filter to
  // 'pending'/'accepted'/'declined' as before.
  status: 'pending' | 'accepted' | 'declined' | 'removed';
  welcomeMessage?: string;
  timestamp: number;
  channelTopic?: string;
  userId: string;
  pushToken?: string;
  pushPlatform?: 'Android' | 'iOS';
  /**
   * Hex-encoded P-256 (uncompressed, 65 bytes) public key the sender device
   * uses for ECDH-derived per-device key wrapping. Populated only on V2 chat
   * requests; absent for V1 single-device requests.
   */
  senderDevicePubKey?: string;
  /**
   * Hex-encoded sr25519 (32 bytes) statementAccountId of the sender device —
   * the `RemoteModel.proof.signer` of the V2 chat request. Populated only on
   * V2 chat requests. Used as `Contact.devices[].statementAccountId` and as
   * the `RequestDeviceInfo.statementAccountId` key in MultiRequest envelopes.
   */
  senderDeviceStatementAccountId?: string;
  lastUpdate: number;
};

export type MessageContentCodecType = CodecType<typeof MessageContentCodec>;

export type P2PChatManager = {
  readonly isReady: boolean;

  searchPeers: (query: string) => Promise<SearchResult[]>;
  startSession: (peerId: string, peerUsername: string, peerP256PublicKey?: Uint8Array) => Promise<void>;
  removeSession: (peerId: string) => Promise<void>;
  sendMessage: (peerId: string, content: MessageContent) => Promise<{ messageId: string }>;
  markAsRead: (peerId: string) => Promise<void>;

  sendRequest: (peerAccountId: string, peerUsername: string, welcomeMessage?: string) => Promise<void>;
  acceptRequest: (requestId: string) => Promise<void>;
  declineRequest: (requestId: string) => Promise<void>;
  cancelOutgoingRequest: (requestId: string, peerId: string) => Promise<void>;
  setBlocked: (peerId: string, blocked: boolean) => Promise<void>;

  initialize: () => Promise<void>;
  dispose: VoidFunction;
};

export type SearchResult = {
  candidateAccountId: string;
  username: string;
  status: string;
};

export type PeerIdentity = {
  accountId: string;
  username: string;
  identifierKey: Uint8Array;
};

export type P2POutboxEntry = {
  id: string;
  peerId: string;
  content: unknown;
  timestamp: number;
  status: 'queued' | 'submitting' | 'delivered' | 'failed';
};

/**
 * Persistence port for a session's outbox. Injected by the manager (keyed by
 * user + peer) so `chatSessionV2` stays storage-agnostic and unit-testable
 * with an in-memory fake.
 */
export type OutboxPort = {
  load: () => OutboxRecord | null;
  save: (record: OutboxRecord) => void;
  clear: () => void;
};
