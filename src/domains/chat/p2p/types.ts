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

// Persisted-entity types are derived from their Dexie-boundary schemas —
// the schema is the source of truth; re-exported here so module-internal
// consumers keep importing entity types from `types.ts`.
export type { P2PChatRequest, P2PRoom } from './schemas';

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
