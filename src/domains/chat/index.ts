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
  useDeclaredProductRooms,
  useProductRooms,
  useProductSessions,
  useUserProductRooms,
} from './product/hooks';
export { clearDeclaredProductRooms, declaredProductRooms$, registerDeclaredProductRoom } from './product/declared-rooms';
export { productChatService } from './product/service';
export { createMessageInProductRoom, createProductRoom, deleteProductRoom, markProductMessagesAsRead } from './product/resource';
export { clearAllProductChatStorage } from './product/repository';

export {
  SUBSCRIPTION_BUDGET,
  clearAllOutboxRecords,
  clearAllP2PChatStorage,
  createP2PChatManagerV2,
  createP2PChatSession,
  downloadChatFile,
  isMessageTooLargeError,
  subscriptionRegistry,
  trackedSubscribeStatements,
  uploadChatFile,
  useNotificationService,
  useP2PRequests,
  useP2PRooms,
} from './p2p';
export type { P2PChatManager, P2PChatRequest, P2PRoom, SearchResult } from './p2p';

export type { ReactionAggregate, ReactorInfo } from './reaction/types';
export { useMessageReactions, useToggleReaction } from './reaction/hooks';
