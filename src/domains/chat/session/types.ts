import { type Observable } from 'rxjs';

import { type AccountId } from '@/domains/network';

export type ProductPeer = {
  type: 'product';
  productId: string;
  name: string;
  icon: string;
};

export type UserPeer = {
  type: 'user';
  accountId: AccountId;
  name: string;
  pin?: string;
};

export type P2PPeer = {
  type: 'p2p';
  accountId: string;
  name: string;
};

export type MessagePeer = ProductPeer | UserPeer | P2PPeer;

export type TextContent = {
  type: 'text';
  text: string;
};

export type GeneralFileMeta = {
  type: 'general';
  mimeType: string;
  fileSize: number;
};

export type ImageFileMeta = {
  type: 'image';
  mimeType: string;
  fileSize: number;
  width: number;
  height: number;
  // Wolt-spec blurhash string, carried inline in the statement (not over HOP),
  // so rendering it triggers no one-shot claim. Optional: absent on older
  // messages and on senders that don't stamp a thumbnail.
  blurhash?: string;
};

export type VideoFileMeta = {
  type: 'video';
  mimeType: string;
  fileSize: number;
  duration: number;
  // See ImageFileMeta.blurhash.
  blurhash?: string;
};

export type FileMeta = GeneralFileMeta | ImageFileMeta | VideoFileMeta;

export type FileAttachment = {
  identifier: Uint8Array;
  claimTicket: Uint8Array;
  // WSS URL of the hop node the sender uploaded to. Receivers validate
  // it against their bulletin-chain hop allowlist before opening a socket.
  // Optional locally: older messages persisted before this field was added,
  // and incoming messages from clients that don't stamp the endpoint, may
  // leave it unset. Outgoing wire encoders fall back to the current
  // environment's first hop endpoint.
  nodeEndpoint?: string;
  meta: FileMeta;
};

export type RichTextContent = {
  type: 'richText';
  text?: string;
  attachments?: FileAttachment[];
};

export type CustomContent = {
  type: 'custom';
  messageType: string;
  payload: Uint8Array;
};

export type ReactionContent = {
  type: 'reacted' | 'reactionRemoved';
  messageId: string;
  emoji: string;
};

export type ReplyContent = {
  type: 'reply';
  messageId: string;
  content: MessageContent;
};

export type EditContent = {
  type: 'edit';
  messageId: string;
  newContent: RichTextContent;
};

export type ContactAddedContent = {
  type: 'contactAdded';
};

export type LeftChatContent = {
  type: 'leftChat';
};

/**
 * `token` (chat-content variant #1). The peer's push-notification token,
 * persisted as a chat-message row so it propagates through `device-sync`
 * (Messages entity) to the user's other paired devices — the applier writes it
 * into the sibling's `rooms.peerPushToken`, letting that device send push
 * notifications to the peer. Mirrors Android, which keeps the received `Token`
 * statement as a chat message alongside the contact push-token field. Never
 * user-facing: excluded from every visible surface via
 * `chatMessageService.isSyncCarrier` (no text/preview → empty bubble otherwise).
 *
 * `token` is hex **without** the `0x` prefix, matching `rooms.peerPushToken`
 * storage. `iOSVoIP` is never stored locally (CallKit-only; desktop can't use
 * it), so `platform` is the 2-variant `'Android' | 'iOS'`.
 */
export type TokenContent = {
  type: 'token';
  token: string;
  platform: 'Android' | 'iOS';
};

/**
 * V2 multi-device chat accept signal, persisted as a chat-message row so it
 * propagates through `device-sync` to the user's other paired devices.
 *
 * Carries the **acceptor's** device info — the receiver applies it to
 * `Contact(peerId).devices` so subsequent sends can target that device
 * directly. Never user-facing: excluded from every visible surface via
 * `chatMessageService.isSyncCarrier` (it has no text/preview, so rendering one
 * would produce an empty bubble).
 *
 * `statementAccountId` and `encryptionPublicKey` are 0x-prefixed hex, matching
 * `Contact.Device.*` storage format.
 */
export type DeviceChatAcceptedContent = {
  type: 'deviceChatAccepted';
  requestId: string;
  statementAccountId: string;
  encryptionPublicKey: string;
};

/**
 * `deviceAdded` (chat-content variant #17). Persisted locally when this device
 * learns a *new* peer device from the peer's identity-channel fan-out, so the
 * addition propagates through `device-sync` (Messages entity) to our other
 * paired devices — the applier re-adds it to `Contact(peerId).devices`. Without
 * this, a sibling that didn't see the live fan-out never learns the peer device
 * and silently drops its `MultiRequest`s. Same role as `DeviceChatAcceptedContent`,
 * but for additions after the initial accept. Never user-facing (no preview text).
 *
 * `statementAccountId` and `encryptionPublicKey` are 0x-prefixed hex, matching
 * `Contact.Device.*` storage format.
 */
export type DeviceAddedContent = {
  type: 'deviceAdded';
  statementAccountId: string;
  encryptionPublicKey: string;
};

// SDK `coinagePayment` (#16) and `send` (#2) — both render as the same
// "Funds Send" bubble. `kind` is preserved so a future divergence
// (coinage-only status, legacy-only explorer link) does not need a migration.
// `assetId === null` means native; a 0x-hex string is an AssetHub asset id.
// `coinageStatus` is the coinage-only delivery lifecycle (kind === 'coinage'
// only). Orthogonal to the chat-channel `status.state` on `ChatMessage`: the
// latter says whether the memo reached the peer, this one says where the
// underlying coin handoff is on its 5-step path. Optional everywhere because
// real on-chain wiring doesn't populate it yet — currently driven by the
// debug-only coinage preview thread.
export type TransferContent = {
  type: 'transfer';
  kind: 'coinage' | 'legacy';
  amount: bigint;
  assetId?: string | null;
  blockHash?: Uint8Array;
  extrinsicHash?: Uint8Array;
  coinageStatus?: 'submitting' | 'sending' | 'sent' | 'delivered' | 'claimed';
};

// All four wire signals are persisted; the UI folds answer / ice / closed
// back into the offer when deriving call state (see features/chat/ui/helpers/callState.ts).
// `purpose` is only set on `offer`; `offerMessageId` only on the other three.
export type CallSignalContent = {
  type: 'callSignal';
  signal: 'offer' | 'answer' | 'ice' | 'closed';
  purpose?: 'audio' | 'video';
  offerMessageId?: string;
};

export type MessageContent =
  | TextContent
  | RichTextContent
  | CustomContent
  | ReactionContent
  | ReplyContent
  | EditContent
  | ContactAddedContent
  | LeftChatContent
  | TokenContent
  | DeviceChatAcceptedContent
  | DeviceAddedContent
  | TransferContent
  | CallSignalContent;

export type OutgoingStatus = {
  direction: 'outgoing';
  state: 'new' | 'sent' | 'delivered';
};

export type IncomingStatus = {
  direction: 'incoming';
  state: 'new' | 'seen';
};

export type ChatMessageStatus = OutgoingStatus | IncomingStatus;

export type ChatMessage = {
  messageId: string;
  sessionId: string;
  peer: MessagePeer;
  timestamp: number;
  content: MessageContent;
  status: ChatMessageStatus;
  lastUpdate?: number;
};

export type ChatSession = {
  readonly sessionId: string;
  readonly roomId: string;
  readonly name: Observable<string>;
  readonly messages: Observable<ChatMessage[]>;
  readonly lastMessage: Observable<ChatMessage | null>;
  readonly unreadCount: Observable<number>;
  readonly participants: Observable<MessagePeer[]>;
  // Only sessions that support per-peer blocking expose this pair (currently P2P).
  // UI gates the block menu on `setBlocked` being present.
  readonly isBlocked?: Observable<boolean>;

  sendMessage(content: MessageContent): Promise<{ messageId: string }>;
  markAsRead(): Promise<void>;
  deleteSession(): Promise<void>;
  setBlocked?(blocked: boolean): Promise<void>;

  onUserMessage(callback: (message: ChatMessage) => void): VoidFunction;
};
