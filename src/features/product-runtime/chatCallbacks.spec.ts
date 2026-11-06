import 'fake-indexeddb/auto';

import { asProductId } from '@parity/truapi';
import { BehaviorSubject } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { productChatService, productRoomUseCase } from '@/domains/chat';
// eslint-disable-next-line boundaries/dependencies -- the test observes the write where it lands; the barrel exposes no seam for it
import { chatDatabase } from '@/domains/chat/product/repository';
import { truapiRuntimeUseCase } from '@/aggregates/truapi-runtime';

import { createChatCallbacks } from './chatCallbacks';

// The room use case is a plain object, spied in place. The message write is a bare
// function over the product chat table, so it runs for real on the fake IndexedDB
// imported above and the row is read back where it landed.
const createProductRoomMock = vi.spyOn(productRoomUseCase, 'createProductRoom');
const setUserInputMock = vi.spyOn(productRoomUseCase, 'setProductRoomUserInput');
const watchProductRoomsMock = vi.spyOn(productRoomUseCase, 'watchProductRooms');

const USER: `0x${string}` = `0x${'11'.repeat(32)}`;
const product = { productId: asProductId('demo.dot'), executionKind: 'Worker' as const };

function connect() {
  truapiRuntimeUseCase.publishAuthState({ tag: 'Connected', value: { publicKey: USER, identityAccountId: USER } });
}

afterEach(async () => {
  truapiRuntimeUseCase.dispose();
  vi.clearAllMocks();
  await chatDatabase.messages.clear();
});

describe('createChatCallbacks', () => {
  it('creates a room under the connected identity', async () => {
    connect();
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- the callbacks read only these fields of the double
    createProductRoomMock.mockResolvedValue({ room: {}, status: 'New' } as never);

    const result = { current: createChatCallbacks() };

    await expect(result.current.chat.createChatRoom(product, { roomId: 'r1', name: 'R', icon: '' })).resolves.toEqual({
      status: 'New',
    });
    expect(createProductRoomMock).toHaveBeenCalledWith({ roomId: 'r1', productId: 'demo.dot', userId: USER });
  });

  it('rejects createChatRoom when auth settles disconnected', async () => {
    truapiRuntimeUseCase.publishAuthState({ tag: 'Disconnected' });

    const result = { current: createChatCallbacks() };

    await expect(result.current.chat.createChatRoom(product, { roomId: 'r1', name: 'R', icon: '' })).rejects.toEqual({
      tag: 'PermissionDenied',
    });
    expect(createProductRoomMock).not.toHaveBeenCalled();
  });

  it('registers a bot as New without persisting or resolving identity', async () => {
    truapiRuntimeUseCase.publishAuthState({ tag: 'Disconnected' });

    const result = { current: createChatCallbacks() };

    await expect(result.current.chat.registerChatBot(product, { botId: 'b1', name: 'B', icon: '' })).resolves.toEqual({
      status: 'New',
    });
  });

  it('posts a message under the derived session id', async () => {
    connect();

    const result = { current: createChatCallbacks() };
    const response = await result.current.chat.postChatMessage(product, {
      roomId: 'r1',
      payload: { tag: 'Text', value: { text: 'hi' } },
    });

    expect(response.messageId).toEqual(expect.any(String));
    expect(await chatDatabase.messages.get(response.messageId)).toEqual(
      expect.objectContaining({
        sessionId: productChatService.getSessionId('demo.dot', 'r1', USER),
        content: { type: 'text', text: 'hi' },
        peer: expect.objectContaining({ type: 'product', productId: 'demo.dot' }),
        status: { direction: 'incoming', state: 'new' },
      }),
    );
  });

  it('stores alt with a posted custom message', async () => {
    connect();

    const result = { current: createChatCallbacks() };
    const response = await result.current.chat.postChatMessage(product, {
      roomId: 'r1',
      payload: { tag: 'Custom', value: { messageType: 'flip', payload: '0x01' } },
      alt: 'Coin flip result',
    });

    const row = await chatDatabase.messages.get(response.messageId);
    expect(row?.content).toMatchObject({ type: 'custom', alt: 'Coin flip result' });
  });

  it('maps an Empty footer to user input none', async () => {
    connect();
    setUserInputMock.mockResolvedValue('Applied');

    const result = { current: createChatCallbacks() };

    await expect(result.current.chat.setChatRoomFooter(product, { roomId: 'r1', footer: 'Empty' })).resolves.toBeUndefined();
    expect(setUserInputMock).toHaveBeenCalledWith({ productId: 'demo.dot', roomId: 'r1', userId: USER, userInput: 'none' });
  });

  it('maps a TextInput footer to user input text', async () => {
    connect();
    setUserInputMock.mockResolvedValue('Applied');

    const result = { current: createChatCallbacks() };

    await expect(result.current.chat.setChatRoomFooter(product, { roomId: 'r1', footer: 'TextInput' })).resolves.toBeUndefined();
    expect(setUserInputMock).toHaveBeenCalledWith({ productId: 'demo.dot', roomId: 'r1', userId: USER, userInput: 'text' });
  });

  it('rejects setChatRoomFooter with UnknownRoom when the room does not exist', async () => {
    connect();
    setUserInputMock.mockResolvedValue('UnknownRoom');

    const result = { current: createChatCallbacks() };

    await expect(result.current.chat.setChatRoomFooter(product, { roomId: 'r1', footer: 'Empty' })).rejects.toEqual({
      tag: 'UnknownRoom',
    });
  });

  it('rejects setChatRoomFooter with Unknown when auth settles disconnected', async () => {
    truapiRuntimeUseCase.publishAuthState({ tag: 'Disconnected' });

    const result = { current: createChatCallbacks() };

    await expect(result.current.chat.setChatRoomFooter(product, { roomId: 'r1', footer: 'Empty' })).rejects.toMatchObject({
      tag: 'Unknown',
    });
    expect(setUserInputMock).not.toHaveBeenCalled();
  });

  it('rejects postChatMessage with Unknown when auth settles disconnected', async () => {
    truapiRuntimeUseCase.publishAuthState({ tag: 'Disconnected' });

    const result = { current: createChatCallbacks() };

    await expect(
      result.current.chat.postChatMessage(product, { roomId: 'r1', payload: { tag: 'Text', value: { text: 'hi' } } }),
    ).rejects.toEqual({ tag: 'Unknown', value: { reason: 'No connected session' } });
  });

  it('rejects createChatRoom with Unknown when the domain write fails', async () => {
    connect();
    createProductRoomMock.mockRejectedValue(new Error('dexie is down'));

    const result = { current: createChatCallbacks() };

    await expect(result.current.chat.createChatRoom(product, { roomId: 'r1', name: 'R', icon: '' })).rejects.toEqual({
      tag: 'Unknown',
      value: { reason: 'Error: dexie is down' },
    });
  });

  // The design's central requirement: the subscription follows the identity rather than
  // capturing it at open. Auth is published for real — stubbing the auth seam would make
  // this case unobservable.
  it('emits the current rooms and switches identity when auth changes', async () => {
    const alice = new BehaviorSubject([{ roomId: 'a1' }]);
    const bob = new BehaviorSubject([{ roomId: 'b1' }]);
    const OTHER: `0x${string}` = `0x${'22'.repeat(32)}`;
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- the callbacks read only these fields of the double
    watchProductRoomsMock.mockImplementation(({ userId }) => (userId === USER ? alice : bob) as never);

    connect();

    const result = { current: createChatCallbacks() };
    const iterator = result.current.chat.subscribeChatRooms(product)[Symbol.asyncIterator]();

    const first = await iterator.next();
    expect(first.value.isOk() && first.value.value).toEqual({ rooms: [{ roomId: 'a1', participatingAs: 'RoomHost' }] });

    truapiRuntimeUseCase.publishAuthState({
      tag: 'Connected',
      value: { publicKey: OTHER, identityAccountId: OTHER },
    });

    const second = await iterator.next();
    expect(second.value.isOk() && second.value.value).toEqual({ rooms: [{ roomId: 'b1', participatingAs: 'RoomHost' }] });

    await iterator.return?.(undefined);
  });

  // The generator this replaced could not unsubscribe here: `return()` would queue
  // behind the idle `await` and only land on the next emission, which may never come.
  it('unsubscribes as soon as the core disposes the stream', async () => {
    const rooms = new BehaviorSubject([{ roomId: 'a1' }]);
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- the callbacks read only these fields of the double
    watchProductRoomsMock.mockReturnValue(rooms as never);
    connect();

    const result = { current: createChatCallbacks() };
    const iterator = result.current.chat.subscribeChatRooms(product)[Symbol.asyncIterator]();

    await iterator.next();
    expect(rooms.observed).toBe(true);

    await iterator.return?.(undefined);

    expect(rooms.observed).toBe(false);
    await expect(iterator.next()).resolves.toEqual({ value: undefined, done: true });
  });

  it('emits an empty room list while auth is not connected', async () => {
    truapiRuntimeUseCase.publishAuthState({ tag: 'Disconnected' });

    const result = { current: createChatCallbacks() };
    const iterator = result.current.chat.subscribeChatRooms(product)[Symbol.asyncIterator]();

    const first = await iterator.next();
    expect(first.value.isOk() && first.value.value).toEqual({ rooms: [] });

    await iterator.return?.(undefined);
  });
});
