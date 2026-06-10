/**
 * UI ↔ host-chat SDK content mappers, shared between V1 and V2 chat managers.
 *
 * The SDK side speaks the discriminated union of `MessageContent` codec
 * shapes (one nested in `ChatMessage.versioned.value`). The UI/domain side
 * uses the flatter `MessageContent` type from `chat/session/types`. These
 * mappers translate both directions so the manager and outbox layers don't
 * need to handle codec specifics.
 */

import { type FileMeta, type MessageContent } from '../session/types';

const isReplyValue = (v: unknown): v is { messageId: string; ownContent: { text?: string | null } } =>
  typeof v === 'object' && v !== null && 'messageId' in v && 'ownContent' in v;

const isReactionValue = (v: unknown): v is { messageId: string; emoji: string } =>
  typeof v === 'object' && v !== null && 'messageId' in v && 'emoji' in v;

const isEditValue = (v: unknown): v is { messageId: string; newContent: { text?: string | null } } =>
  typeof v === 'object' && v !== null && 'messageId' in v && 'newContent' in v;

type SdkNodeEndpoint = { tag: 'wssUrl'; value: { url: string } };

type SdkAttachment = {
  tag: string;
  value: {
    identifier: Uint8Array;
    claimTicket: Uint8Array;
    nodeEndpoint?: SdkNodeEndpoint;
    meta: { tag: string; value: unknown };
  };
};

const extractNodeEndpoint = (endpoint: unknown): string | undefined => {
  if (typeof endpoint !== 'object' || endpoint === null) return undefined;
  if (!('tag' in endpoint) || endpoint.tag !== 'wssUrl') return undefined;
  if (!('value' in endpoint) || typeof endpoint.value !== 'object' || endpoint.value === null) return undefined;
  const { value } = endpoint;
  if (!('url' in value) || typeof value.url !== 'string') return undefined;
  return value.url;
};

// `defaultEndpoint` (the active env's first HOP endpoint) is resolved by the
// caller and threaded in, since this mapper is synchronous and config is async.
const buildOutgoingNodeEndpoint = (stored: string | undefined, defaultEndpoint: string): SdkNodeEndpoint => {
  return { tag: 'wssUrl', value: { url: stored ?? defaultEndpoint } };
};

const isRichTextValue = (
  v: unknown,
): v is {
  text?: string | null;
  attachments?: SdkAttachment[] | null;
} => typeof v === 'object' && v !== null;

type GeneralMetaShape = { mimeType: string; fileSize: number };
type ImageMetaShape = { general: GeneralMetaShape; width: number; height: number; thumbnail?: Uint8Array | null };
type VideoMetaShape = { general: GeneralMetaShape; duration: number; thumbnail?: Uint8Array | null };

const isGeneralMeta = (v: unknown): v is GeneralMetaShape =>
  typeof v === 'object' && v !== null && 'mimeType' in v && 'fileSize' in v;

const isImageMeta = (v: unknown): v is ImageMetaShape =>
  typeof v === 'object' && v !== null && 'general' in v && 'width' in v && 'height' in v;

const isVideoMeta = (v: unknown): v is VideoMetaShape => typeof v === 'object' && v !== null && 'general' in v && 'duration' in v;

const isCoinagePaymentValue = (v: unknown): v is { totalValue: bigint | number | string } =>
  typeof v === 'object' && v !== null && 'totalValue' in v;

const isSendValue = (
  v: unknown,
): v is {
  amount: bigint | number | string;
  assetId?: string | null;
  blockHash?: Uint8Array;
  extrinsicHash?: Uint8Array;
} => typeof v === 'object' && v !== null && 'amount' in v;

const isOfferValue = (v: unknown): v is { purpose: 'AUDIO_CALL' | 'VIDEO_CALL' | { tag: 'AUDIO_CALL' | 'VIDEO_CALL' } } =>
  typeof v === 'object' && v !== null && 'purpose' in v;

const isOfferRefValue = (v: unknown): v is { offerMessageId: string } =>
  typeof v === 'object' && v !== null && 'offerMessageId' in v;

// The SCALE `Status` codec decodes a variant either as a bare tag string or
// as `{ tag, value }` depending on the codec version — accept both shapes.
const extractCallPurpose = (purpose: unknown): 'audio' | 'video' | null => {
  let tag: unknown;
  if (typeof purpose === 'string') {
    tag = purpose;
  } else if (typeof purpose === 'object' && purpose !== null && 'tag' in purpose) {
    tag = purpose.tag;
  } else {
    return null;
  }
  if (tag === 'VIDEO_CALL') return 'video';
  if (tag === 'AUDIO_CALL') return 'audio';
  return null;
};

export const mapFileMeta = (meta: { tag: string; value: unknown }): FileMeta | null => {
  switch (meta.tag) {
    case 'general': {
      if (!isGeneralMeta(meta.value)) return null;
      return { type: 'general', mimeType: meta.value.mimeType, fileSize: meta.value.fileSize };
    }
    case 'image': {
      if (!isImageMeta(meta.value)) return null;
      return {
        type: 'image',
        mimeType: meta.value.general.mimeType,
        fileSize: meta.value.general.fileSize,
        width: meta.value.width,
        height: meta.value.height,
      };
    }
    case 'video': {
      if (!isVideoMeta(meta.value)) return null;
      return {
        type: 'video',
        mimeType: meta.value.general.mimeType,
        fileSize: meta.value.general.fileSize,
        duration: meta.value.duration,
      };
    }
    default:
      return null;
  }
};

export const mapSdkContent = (content: { tag: string; value: unknown }): MessageContent | null => {
  switch (content.tag) {
    case 'text':
      return { type: 'text', text: String(content.value) };
    case 'richText': {
      if (!isRichTextValue(content.value)) return null;
      const attachments =
        content.value.attachments
          ?.map(a => {
            if (a.tag !== 'p2pMixnet') return null;
            const meta = mapFileMeta(a.value.meta);
            if (!meta) return null;
            return {
              identifier: a.value.identifier,
              claimTicket: a.value.claimTicket,
              nodeEndpoint: extractNodeEndpoint(a.value.nodeEndpoint),
              meta,
            };
          })
          .filter((a): a is NonNullable<typeof a> => a !== null) ?? [];

      return { type: 'richText', text: content.value.text ?? undefined, attachments };
    }
    case 'leftChat':
      return { type: 'leftChat' };
    case 'reply': {
      if (!isReplyValue(content.value)) return null;
      return {
        type: 'reply',
        messageId: content.value.messageId,
        content: { type: 'text', text: content.value.ownContent?.text ?? '' },
      };
    }
    case 'reacted': {
      if (!isReactionValue(content.value)) return null;
      return { type: 'reacted', messageId: content.value.messageId, emoji: content.value.emoji };
    }
    case 'reactionRemoved': {
      if (!isReactionValue(content.value)) return null;
      return { type: 'reactionRemoved', messageId: content.value.messageId, emoji: content.value.emoji };
    }
    case 'edit': {
      if (!isEditValue(content.value)) return null;
      return {
        type: 'edit',
        messageId: content.value.messageId,
        newContent: { type: 'richText', text: content.value.newContent?.text ?? '' },
      };
    }
    case 'coinagePayment': {
      if (!isCoinagePaymentValue(content.value)) return null;
      return { type: 'transfer', kind: 'coinage', amount: BigInt(content.value.totalValue) };
    }
    case 'send': {
      if (!isSendValue(content.value)) return null;
      return {
        type: 'transfer',
        kind: 'legacy',
        amount: BigInt(content.value.amount),
        assetId: content.value.assetId ?? null,
        blockHash: content.value.blockHash,
        extrinsicHash: content.value.extrinsicHash,
      };
    }
    case 'dataChannelOffer': {
      if (!isOfferValue(content.value)) return null;
      const purpose = extractCallPurpose(content.value.purpose);
      if (!purpose) return null;
      return { type: 'callSignal', signal: 'offer', purpose };
    }
    case 'dataChannelAnswer': {
      if (!isOfferRefValue(content.value)) return null;
      return { type: 'callSignal', signal: 'answer', offerMessageId: content.value.offerMessageId };
    }
    case 'dataChannelIceCandidate': {
      if (!isOfferRefValue(content.value)) return null;
      return { type: 'callSignal', signal: 'ice', offerMessageId: content.value.offerMessageId };
    }
    case 'dataChannelClosed': {
      if (!isOfferRefValue(content.value)) return null;
      return { type: 'callSignal', signal: 'closed', offerMessageId: content.value.offerMessageId };
    }
    default:
      console.warn('[chat-content-mappers] Unknown SDK content tag:', content.tag);
      return null;
  }
};

export const mapUiContentToSdk = (content: MessageContent, defaultNodeEndpoint = ''): { tag: string; value: unknown } | null => {
  switch (content.type) {
    case 'text':
      return { tag: 'text', value: content.text };
    case 'richText': {
      const attachments = content.attachments?.map(a => ({
        tag: 'p2pMixnet' as const,
        value: {
          identifier: a.identifier,
          claimTicket: a.claimTicket,
          nodeEndpoint: buildOutgoingNodeEndpoint(a.nodeEndpoint, defaultNodeEndpoint),
          meta:
            a.meta.type === 'image'
              ? {
                  tag: 'image' as const,
                  value: {
                    general: { mimeType: a.meta.mimeType, fileSize: a.meta.fileSize },
                    width: a.meta.width,
                    height: a.meta.height,
                    thumbnail: undefined,
                  },
                }
              : a.meta.type === 'video'
                ? {
                    tag: 'video' as const,
                    value: {
                      general: { mimeType: a.meta.mimeType, fileSize: a.meta.fileSize },
                      duration: a.meta.duration,
                      thumbnail: undefined,
                    },
                  }
                : { tag: 'general' as const, value: { mimeType: a.meta.mimeType, fileSize: a.meta.fileSize } },
        },
      }));
      return { tag: 'richText', value: { text: content.text ?? undefined, attachments: attachments ?? undefined } };
    }
    case 'reply': {
      const innerText = content.content.type === 'text' ? content.content.text : '';
      return {
        tag: 'reply',
        value: { messageId: content.messageId, ownContent: { text: innerText, attachments: undefined } },
      };
    }
    case 'reacted':
      return { tag: 'reacted', value: { messageId: content.messageId, emoji: content.emoji } };
    case 'reactionRemoved':
      return { tag: 'reactionRemoved', value: { messageId: content.messageId, emoji: content.emoji } };
    case 'edit':
      return {
        tag: 'edit',
        value: { messageId: content.messageId, newContent: { text: content.newContent.text, attachments: undefined } },
      };
    // Desktop never initiates transfers or calls — both render-only.
    case 'transfer':
    case 'callSignal':
      return null;
    default:
      return null;
  }
};
