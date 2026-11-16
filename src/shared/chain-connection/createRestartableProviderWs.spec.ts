import { type JsonRpcMessage, type JsonRpcRequest } from '@polkadot-api/json-rpc-provider';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createRestartableProvider } from './createRestartableProvider';
import { createWsJsonRpcProvider } from './createWsJsonRpcProvider';

// Integration: createRestartableProvider on top of a real createWsJsonRpcProvider.
// Both layers replay subscriptions, and a restart is the one moment they overlap
// — the outer layer re-sends into a transport whose socket has not opened yet —
// so the composition is what has to be tested, not either wrapper alone.

type Listener = (event: unknown) => void;

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];

  readonly sent: string[] = [];
  readonly url: string;
  private readonly listeners = new Map<string, Set<Listener>>();

  constructor(url: string) {
    this.url = url;
    FakeWebSocket.instances.push(this);
  }

  addEventListener(type: string, listener: Listener): void {
    const forType = this.listeners.get(type) ?? new Set<Listener>();
    forType.add(listener);
    this.listeners.set(type, forType);
  }

  removeEventListener(type: string, listener: Listener): void {
    this.listeners.get(type)?.delete(listener);
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.emit('close', { type: 'close' });
  }

  open(): void {
    this.emit('open', { type: 'open' });
  }

  deliver(message: JsonRpcMessage): void {
    this.emit('message', { data: JSON.stringify(message) });
  }

  requests(method: string): JsonRpcRequest[] {
    return this.sent.map(raw => JSON.parse(raw)).filter(message => message.method === method);
  }

  private emit(type: string, event: unknown): void {
    for (const listener of [...(this.listeners.get(type) ?? [])]) listener(event);
  }
}

const subscribe: JsonRpcRequest = { jsonrpc: '2.0', id: 1, method: 'state_subscribeStorage', params: [['0x00']] };

// The proxy schedules each connect attempt on a timer, and a restart lands on
// its reconnect backoff — one window covers both.
function settle() {
  return vi.advanceTimersByTimeAsync(1_000);
}

describe('createRestartableProvider × createWsJsonRpcProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    FakeWebSocket.instances.length = 0;
  });
  afterEach(() => vi.useRealTimers());

  it('re-establishes a legacy subscription exactly once on the new socket', async () => {
    const provider = createRestartableProvider(() =>
      createWsJsonRpcProvider({
        endpoints: ['wss://example.test'],
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- FakeWebSocket implements only the members the provider calls, so no typed fake can stand in for the full `typeof WebSocket`
        websocketClass: FakeWebSocket as unknown as typeof WebSocket,
      }),
    );

    const messages: JsonRpcMessage[] = [];
    const connection = provider(message => messages.push(message));
    await settle();

    const first = FakeWebSocket.instances[0]!;
    first.open();
    connection.send(subscribe);
    first.deliver({ jsonrpc: '2.0', id: 1, result: 'sub-1' });

    provider.restart();
    await settle();

    const second = FakeWebSocket.instances[1]!;
    second.open();

    // Twice would leave the second subId subscribed server-side with nothing
    // holding it: the ws proxy drops the duplicate response, so neither replay
    // layer ever learns that id and neither will unsubscribe it.
    expect(second.requests('state_subscribeStorage')).toHaveLength(1);

    // And the consumer keeps routing on the subId it was given.
    second.deliver({ jsonrpc: '2.0', id: 1, result: 'sub-2' });
    second.deliver({
      jsonrpc: '2.0',
      method: 'state_storage',
      params: { subscription: 'sub-2', result: '0x01' },
    });

    expect(messages).toContainEqual(expect.objectContaining({ params: { subscription: 'sub-1', result: '0x01' } }));
  });
});
