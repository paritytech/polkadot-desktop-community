import { type MessageContent as MessageContentCodec } from '@novasamatech/host-chat/codec/message';
import { type CodecType } from 'scale-ts';

import { type MessageContent } from '../session/types';

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
  startSession: (peerId: string, peerUsername: string) => Promise<void>;
  removeSession: (peerId: string) => Promise<void>;
  sendMessage: (peerId: string, content: MessageContent) => Promise<{ messageId: string }>;
  markAsRead: (peerId: string) => Promise<void>;

  sendRequest: (peerAccountId: string, peerUsername: string, welcomeMessage?: string) => Promise<void>;
  acceptRequest: (requestId: string) => Promise<void>;
  declineRequest: (requestId: string) => Promise<void>;
  revealRequest: (requestId: string) => Promise<void>;
  cancelOutgoingRequest: (requestId: string, peerId: string) => Promise<void>;
  setBlocked: (peerId: string, blocked: boolean) => Promise<void>;

  initialize: () => Promise<void>;
  dispose: VoidFunction;
};

export type IncomingCancelAction = 'tombstone' | 'cancelPending' | 'cancelAccepted' | 'ignore';

export type SearchResult = {
  accountId: string;
  username: string;
  status: string;
};

export type P2POutboxEntry = {
  id: string;
  peerId: string;
  content: unknown;
  timestamp: number;
  status: 'queued' | 'submitting' | 'delivered' | 'failed';
};
