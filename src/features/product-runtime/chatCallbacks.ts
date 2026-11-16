import { type GenericError, type HostChatListSubscribeItem, type Result } from '@parity/truapi';
import { type ChatPlatform } from '@parity/truapi-host';
import { nanoid } from 'nanoid';
import { err, ok } from 'neverthrow';
import { distinctUntilChanged, lastValueFrom, map, of, switchMap } from 'rxjs';

import { type ChatMessage, createMessageInProductRoom, productChatService, productRoomUseCase } from '@/domains/chat';
import { truapiRuntime, truapiRuntimeUseCase } from '@/aggregates/truapi-runtime';

import { productRuntimeService } from './service';

type ChatCallbacks = { chat: Required<ChatPlatform> };

type RoomsItem = Result<HostChatListSubscribeItem, GenericError>;

async function resolveUserId() {
  return truapiRuntimeUseCase.toUserId(await truapiRuntimeUseCase.whenAuthResolved());
}

/**
 * The core's Chat capability, served from the host.
 *
 * One binding serves every product: each method takes a `ProductContext`, so there is
 * no per-worker registration. The core's `has_chat` is all-or-nothing across the
 * methods, which is why this is a typed `ChatPlatform` rather than a loose object —
 * a missing method must fail at compile time, not as a silent `Unsupported` at runtime.
 */
export function createChatCallbacks(): ChatCallbacks {
  return {
    chat: {
      // The refusal is thrown before the `try` so the catch cannot re-wrap it: a
      // `PermissionDenied` must reach the product as itself, not as `Unknown`.
      createChatRoom: async (product, request) => {
        // TODO(chat-workers): diagnostic — remove once the worker-send break is pinned.
        console.info('[chat-worker-diag] createChatRoom', { productId: product.productId, roomId: request.roomId });
        const userId = await resolveUserId().catch(() => null);
        if (!userId) {
          console.info('[chat-worker-diag] createChatRoom refused — no connected session');
          throw { tag: 'PermissionDenied' };
        }

        try {
          const result = await productRoomUseCase.createProductRoom({
            roomId: request.roomId,
            productId: product.productId,
            userId,
          });
          if (!result) throw new Error('product commit failed');

          return { status: result.status };
        } catch (reason) {
          throw { tag: 'Unknown', value: { reason: String(reason) } };
        }
      },

      // Deliberate stub, ported from the deleted worker binding: nothing is persisted and
      // every caller is told the bot is new. Real registration needs a bot record in the
      // chat domain and is a separate change (upstream paritytech/truapi#430).
      registerChatBot: () => Promise.resolve({ status: 'New' }),

      postChatMessage: async (product, request) => {
        // TODO(chat-workers): diagnostic — remove once the worker-send break is pinned.
        console.info('[chat-worker-diag] postChatMessage', { productId: product.productId, roomId: request.roomId });
        const userId = await resolveUserId().catch(() => null);
        if (!userId) throw { tag: 'Unknown', value: { reason: 'No connected session' } };

        const messageId = nanoid(32);

        try {
          const message: ChatMessage = {
            messageId,
            sessionId: productChatService.getSessionId(product.productId, request.roomId, userId),
            timestamp: Date.now(),
            content: productRuntimeService.toChatMessageContent(request.payload, request.alt),
            // The chat domain resolves a product's display name live when it builds a
            // session, so a copy stored here would only go stale.
            peer: { type: 'product', productId: product.productId, name: product.productId, icon: '' },
            status: { direction: 'incoming', state: 'new' },
          };

          await lastValueFrom(createMessageInProductRoom(message));
        } catch (reason) {
          throw { tag: 'Unknown', value: { reason: String(reason) } };
        }

        return { messageId };
      },

      // `UnknownRoom` is thrown outside the `try` for the same reason as `PermissionDenied`
      // above: the catch must not re-wrap it as `Unknown`.
      setChatRoomFooter: async (product, request) => {
        const userId = await resolveUserId().catch(() => null);
        if (!userId) throw { tag: 'Unknown', value: { reason: 'No connected session' } };

        let result: 'Applied' | 'UnknownRoom';
        try {
          result = await productRoomUseCase.setProductRoomFooter({
            productId: product.productId,
            roomId: request.roomId,
            userId,
            footer: productRuntimeService.toRoomFooter(product.productId, request.footer),
          });
        } catch (reason) {
          throw { tag: 'Unknown', value: { reason: String(reason) } };
        }

        if (result === 'UnknownRoom') throw { tag: 'UnknownRoom' };
      },

      subscribeChatRooms: product => subscribeRooms(product.productId),
    },
  };
}

/**
 * Bridges the rooms observable to the async iterable the core consumes.
 *
 * Written as an explicit iterator rather than an `async function*` on purpose. The
 * core's adapter disposes a subscription by calling `iterator.return()`, and a
 * generator only unwinds — running its `finally` — when it is suspended at a
 * `yield`. The adapter's pump calls `next()` immediately after each item, so the
 * generator would almost always be parked at an `await` instead, where a `return()`
 * is queued behind a promise that only settles on the next emission. That leaves the
 * rooms subscription live after disposal, indefinitely if the list never changes
 * again. Owning `return()` makes teardown synchronous.
 *
 * `switchMap` over the auth state is what makes the subscription follow the
 * identity: on sign-out and sign-in it drops the previous user's rooms instead of
 * holding a `userId` captured at open.
 */
function subscribeRooms(productId: string): AsyncIterable<RoomsItem> {
  return {
    [Symbol.asyncIterator]: () => {
      const queue: RoomsItem[] = [];
      let deliver: Nullable<(result: IteratorResult<RoomsItem>) => void> = null;
      let closed = false;

      const push = (item: RoomsItem) => {
        if (closed) return;

        const waiting = deliver;
        if (waiting) {
          deliver = null;
          waiting({ value: item, done: false });
        } else {
          queue.push(item);
        }
      };

      const subscription = truapiRuntime.value$
        .pipe(
          // Dedupe on the auth state, not on the derived id: `toChatUserId` warns and
          // parses, and `value$` also emits when the runtime handle changes.
          map(state => state.authState),
          distinctUntilChanged(),
          map(truapiRuntimeUseCase.toUserId),
          switchMap(userId => (userId ? productRoomUseCase.watchProductRooms({ productId, userId }) : of([]))),
        )
        .subscribe({
          next: rooms => push(ok({ rooms: rooms.map(room => ({ roomId: room.roomId, participatingAs: 'RoomHost' as const })) })),
          error: (reason: unknown) => push(err({ reason: String(reason) })),
        });

      const close = (): IteratorResult<RoomsItem> => {
        if (!closed) {
          closed = true;
          subscription.unsubscribe();
        }

        const waiting = deliver;
        if (waiting) {
          deliver = null;
          waiting({ value: undefined, done: true });
        }

        return { value: undefined, done: true };
      };

      return {
        next: () => {
          if (closed) return Promise.resolve<IteratorResult<RoomsItem>>({ value: undefined, done: true });

          const item = queue.shift();
          if (item) return Promise.resolve<IteratorResult<RoomsItem>>({ value: item, done: false });

          return new Promise<IteratorResult<RoomsItem>>(resolve => {
            deliver = resolve;
          });
        },
        return: () => Promise.resolve(close()),
      };
    },
  };
}
