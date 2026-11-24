export type {
  CallSignalContent,
  ChatMessage,
  ChatMessageStatus,
  ChatSession,
  FileAttachment,
  FileMeta,
  MessageContent,
  MessagePeer,
  MessagePosition,
  P2PPeer,
  RoomFooter,
  TransferContent,
} from './session/types';
export { useMessageSearch } from './$usecase/search.hooks';
export type { MessageSearchHit } from './$usecase/search';
export { useTotalUnreadCount } from './session/hooks';
export { chatMessageService } from './session/service';
export {
  type CallDirection,
  type CallPurpose,
  type CallSessionEffect,
  type CallSessionEvent,
  type CallSessionState,
  type MainToWindowMessage,
  type OfferIdMap,
  type PendingUpgrade,
  type WindowToMainMessage,
  callService,
  callSessionService,
  parseMainToWindow,
  parseWindowToMain,
} from './calls';

export { fileTransferUseCase } from './$usecase/fileTransfer';
export { type OutgoingProductMessage, productRoomUseCase } from './$usecase/productRoom';
export { useCurrentUserPeer, useProductRooms, useProductSessions, useUserProductRooms } from './product/hooks';
export type { ProductChatRoom } from './product/types';
export { productChatService } from './product/service';
export {
  createMessageInProductRoom,
  deleteProductRoom,
  markProductMessagesAsRead,
  messagesResource,
  roomsResource,
} from './product/resource';
// DEBT: on the public surface for `application/$usecase/session.ts` (sign-out teardown).
// Fix: expose it as a chat use case that session.ts composes.
// eslint-disable-next-line local-rules/enforce-import-restrictions
export { clearAllProductChatStorage } from './product/repository';

export {
  SUBSCRIPTION_BUDGET,
  clearAllOutboxRecords,
  clearAllP2PChatStorage,
  createP2PChatManagerV2,
  createP2PChatSession,
  isMessageTooLargeError,
  listBlockedPeerIds,
  p2pService,
  subscriptionRegistry,
  trackedSubscribeStatements,
  useNotificationService,
  useP2PRequests,
  useP2PRooms,
} from './p2p';
export type { P2PChatManager, P2PChatRequest, P2PRoom, SearchResult } from './p2p';

export type { ReactionAggregate, ReactorInfo } from './reaction/types';
export { useMessageReactions, useToggleReaction } from './reaction/hooks';

export { useHideRequestsByDefault, useSetHideRequestsByDefault } from './request-preferences/hooks';
export { p2pMessagesResource, p2pRequestsResource, p2pRoomsResource } from './p2p/resource';
export { hideRequestsByDefaultResource } from './request-preferences/resource';
