import {
  type ChatMessageContent,
  type CodecType,
  ChatBotRegistrationErr,
  ChatMessagePostingErr,
  ChatRoomRegistrationErr,
} from '@novasamatech/host-api';
import { nanoid } from 'nanoid';
import { type ResultAsync, errAsync, fromPromise } from 'neverthrow';
import { lastValueFrom, map } from 'rxjs';

import {
  type ChatMessage,
  type MessageContent,
  clearDeclaredProductRooms,
  createMessageInProductRoom,
  declaredProductRooms$,
  productChatService,
  registerDeclaredProductRoom,
} from '@/domains/chat';

import { guarded } from './guarded';
import { type Binding, type ProductWorkerInstance, type WorkerDeps } from './types';

type ProductChatMessage = CodecType<typeof ChatMessageContent>;

// If the worker has been disposed mid-async, calling ok/err would write a
// JSValue into a torn-down VM (the original use-after-free). Skip the call
// and synthesise a same-typed error instead — nothing reads it because the
// container is also gone.
function ifAlive<T, E>(instance: ProductWorkerInstance, liveResult: () => ResultAsync<T, E>, disposedErr: E): ResultAsync<T, E> {
  return instance.disposed ? errAsync(disposedErr) : liveResult();
}

function toMessageContent(payload: ProductChatMessage): MessageContent {
  switch (payload.tag) {
    case 'Text':
      return { type: 'text', text: payload.value };
    case 'RichText':
      return { type: 'richText', text: payload.value.text };
    case 'Reaction':
      return { type: 'reacted', messageId: payload.value.messageId, emoji: payload.value.emoji };
    case 'ReactionRemoved':
      return { type: 'reactionRemoved', messageId: payload.value.messageId, emoji: payload.value.emoji };
    case 'Custom':
      return { type: 'custom', messageType: payload.value.messageType, payload: payload.value.payload };
    default:
      return { type: 'text', text: 'Unsupported message format' };
  }
}

export function chatCreateRoomBinding(instance: ProductWorkerInstance, deps: WorkerDeps): VoidFunction {
  const removeHandler = instance.container.handleChatCreateRoom(({ roomId }, { ok, err }) => {
    const session = deps.getSession();
    if (!session) {
      return err(new ChatRoomRegistrationErr.PermissionDenied());
    }

    const status = registerDeclaredProductRoom({
      roomId,
      productId: instance.productId,
    });

    return ifAlive(instance, () => ok({ status }), new ChatRoomRegistrationErr.Unknown({ reason: 'disposed' }));
  });

  // Declared rooms only mirror this running worker — drop them when it is disposed.
  return () => {
    removeHandler();
    clearDeclaredProductRooms(instance.productId);
  };
}

export function chatBotRegistrationBinding(instance: ProductWorkerInstance): VoidFunction {
  return instance.container.handleChatBotRegistration((_, { ok }) =>
    ifAlive(instance, () => ok({ status: 'New' }), new ChatBotRegistrationErr.Unknown({ reason: 'disposed' })),
  );
}

export function chatListSubscribeBinding(instance: ProductWorkerInstance): VoidFunction {
  return instance.container.handleChatListSubscribe((_, send) => {
    const sendG = guarded(instance, send);
    // BehaviorSubject-backed: replays the current snapshot on subscribe and
    // re-emits whenever the worker declares a new room, so the list stays live.
    const subscription = declaredProductRooms$
      .pipe(map(rooms => rooms.filter(room => room.productId === instance.productId)))
      .subscribe(rooms => {
        sendG(rooms.map(room => ({ roomId: room.roomId, participatingAs: 'RoomHost' as const })));
      });

    return () => subscription.unsubscribe();
  });
}

export function chatPostMessageBinding(instance: ProductWorkerInstance, deps: WorkerDeps): VoidFunction {
  return instance.container.handleChatPostMessage(({ roomId, payload }, { ok, err }) => {
    const session = deps.getSession();

    if (!session) {
      return err(new ChatMessagePostingErr.Unknown({ reason: 'Session not found' }));
    }

    const product = deps.getProduct();
    const sessionId = productChatService.getSessionId(product.baseName, roomId, productChatService.getUserId(session));
    const chatSession = deps.getChatSessions().find(s => s.sessionId === sessionId);

    if (!chatSession) {
      return err(new ChatMessagePostingErr.Unknown({ reason: 'Session not found' }));
    }

    const messageId = nanoid(32);
    const message: ChatMessage = {
      messageId,
      timestamp: Date.now(),
      sessionId,
      content: toMessageContent(payload),
      peer: {
        type: 'product',
        productId: product.baseName,
        name: product.displayName,
        icon: '',
      },
      status: { direction: 'incoming', state: 'new' },
    };

    const disposedErr = () => new ChatMessagePostingErr.Unknown({ reason: 'disposed' });
    return fromPromise(lastValueFrom(createMessageInProductRoom(message)), e => e)
      .andThen(() => ifAlive(instance, () => ok({ messageId }), disposedErr()))
      .orElse(e => ifAlive(instance, () => err(new ChatMessagePostingErr.Unknown({ reason: String(e) })), disposedErr()));
  });
}

export function chatActionSubscribeBinding(instance: ProductWorkerInstance, deps: WorkerDeps): VoidFunction {
  return instance.container.handleChatActionSubscribe((_, send, interrupt) => {
    const sendG = guarded(instance, send);
    const interruptG = guarded(instance, interrupt);

    const session = deps.getSession();
    if (!session) {
      interruptG(undefined);
      return () => {};
    }

    const unsub = instance.events.on('sendChatAction', (roomId, productId, payload) => {
      sendG({ roomId, peer: productId, payload });
    });

    return () => unsub();
  });
}

export const defaultWorkerBindings: Binding[] = [
  chatCreateRoomBinding,
  chatBotRegistrationBinding,
  chatListSubscribeBinding,
  chatPostMessageBinding,
  chatActionSubscribeBinding,
];
