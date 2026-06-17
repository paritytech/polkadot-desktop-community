/**
 * Project-local rebuild of `@novasamatech/host-chat`'s `ChatMessage` SCALE
 * codec. Identical to the SDK version except for the `Platform` enum inside
 * `TokenContent`, which the SDK declares as `Status('Android', 'iOS')` — a
 * two-variant Status. iOS PApp encodes a third variant (`iosVoIP` = 2) for
 * VoIP push tokens, so any envelope carrying such a token fails to decode on
 * desktop with `Unknown status index: 2`.
 *
 * This is the single chat-wire `ChatMessage` codec for the whole app. Every
 * path that DECODES messages from a peer must use it so an iOS VoIP token
 * never throws —
 *   - the live session channel (`chatSessionV2.ts`),
 *   - the identity channel (`acceptSignalV2.ts`),
 *   - and `device-sync` (`device-sync/codec.ts`).
 * Decoders advance past the third-variant byte and the consumer ignores the
 * token (chat content mappers / appliers skip it defensively). `pushNotification.ts`
 * only ENCODES the desktop's own outgoing content (never an iOSVoIP token), so
 * it keeps using the SDK codec for its `MessageContent` type.
 *
 * Once the SDK ships a 3-variant `Platform` we can drop this file and
 * re-import `ChatMessage` from `@novasamatech/host-chat/codec/message`.
 *
 * All other Android-specific payload-bearing variants (data-channel
 * signalling, coinage payments) are now defined in the SDK proper — we
 * just import them so the decoder consumes the right number of bytes when
 * an envelope mixes them with other entries.
 */

import {
  ChatAcceptedContent,
  CoinagePaymentContent,
  DataChannelAnswerContent,
  DataChannelClosedContent,
  DataChannelIceCandidateContent,
  DataChannelOfferContent,
  DeviceAddedContent,
  DeviceChatAcceptedContent,
  DeviceRemovedContent,
  EditContent,
  ReactionContent,
  ReplyContent,
  RichTextContent,
  SendContent,
  TextContent,
} from '@novasamatech/host-chat/codec/message';
import { Enum, Hex, Status } from '@novasamatech/scale';
import { Struct, _void, str, u64 } from 'scale-ts';

// Platform with the third iOS-only variant. Byte ordinals are part of the
// wire format; do not reorder.
const Platform = Status('Android', 'iOS', 'iOSVoIP');

const TokenContent = Struct({
  token: Hex(),
  platform: Platform,
});

const MessageContent = Enum({
  text: TextContent, // 0
  token: TokenContent, // 1 — local override (3-variant Platform)
  send: SendContent, // 2
  contactAdded: _void, // 3
  reacted: ReactionContent, // 4
  reactionRemoved: ReactionContent, // 5
  _reserved6: _void, // 6
  reply: ReplyContent, // 7
  dataChannelOffer: DataChannelOfferContent, // 8
  dataChannelAnswer: DataChannelAnswerContent, // 9
  dataChannelIceCandidate: DataChannelIceCandidateContent, // 10
  dataChannelClosed: DataChannelClosedContent, // 11
  edit: EditContent, // 12
  leftChat: _void, // 13
  chatAccepted: ChatAcceptedContent, // 14
  richText: RichTextContent, // 15
  coinagePayment: CoinagePaymentContent, // 16 — Android-only; desktop just consumes the bytes so it doesn't desync the envelope
  deviceAdded: DeviceAddedContent, // 17
  deviceRemoved: DeviceRemovedContent, // 18
  _reserved19: _void, // 19
  deviceChatAccepted: DeviceChatAcceptedContent, // 20
});

const VersionedMessageContent = Enum({
  v1: MessageContent,
});

export const ChatMessage = Struct({
  messageId: str,
  timestamp: u64,
  versioned: VersionedMessageContent,
});
