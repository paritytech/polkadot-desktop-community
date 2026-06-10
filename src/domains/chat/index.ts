export type {
  CallSignalContent,
  ChatMessage,
  ChatMessageStatus,
  ChatSession,
  FileAttachment,
  FileMeta,
  MessageContent,
  MessagePeer,
  P2PPeer,
  TransferContent,
} from './session/types';
export { useTotalUnreadCount } from './session/hooks';
export { chatMessageService } from './session/service';
export { chatCustomRendererService } from './custom-renderer/service';
export type { ActionHandler } from './custom-renderer/service';

export {
  useCreateProductRoom,
  useCurrentUserPeer,
  useProductRooms,
  useProductSessions,
  useUserProductRooms,
} from './product/hooks';
export { productChatService } from './product/service';
export { createMessageInProductRoom, createProductRoom, deleteProductRoom, markProductMessagesAsRead } from './product/resource';
export { clearAllProductChatStorage } from './product/repository';

export {
  P2PChatManagerProvider,
  useAcceptRequest,
  useCancelOutgoingRequest,
  useContactSearch,
  useDeclineRequest,
  useP2PChatManager,
  useP2PRequests,
  useP2PSessions,
  useSendChatRequest,
} from './p2p/hooks';
export type { P2PChatRequest, P2PRoom, SearchResult } from './p2p/types';

export { downloadChatFile, uploadChatFile } from './p2p/file-transfer';

export { SUBSCRIPTION_BUDGET, subscriptionRegistry, trackedSubscribeStatements } from './p2p/subscription-registry';

export { clearAllOutboxRecords, clearAllP2PChatStorage } from './p2p/repository';

export { decryptAndValidateRequestV2, sendChatRequestV2, subscribeToIncomingRequestsV2 } from './p2p/chatRequestV2';

export { isMessageTooLargeError } from './p2p/chatSessionV2';

export type { ReactionAggregate, ReactorInfo } from './reaction/types';
export { useMessageReactions, useToggleReaction } from './reaction/hooks';
