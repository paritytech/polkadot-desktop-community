import { type JsonRpcMessage, type JsonRpcRequest } from '@polkadot-api/json-rpc-provider';
import { type JsonRpcProvider } from 'polkadot-api';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createRestartableProvider } from './createRestartableProvider';

type FakeTransport = {
  provider: JsonRpcProvider;
  send: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  emit(message: JsonRpcMessage): void;
  pause?: ReturnType<typeof vi.fn>;
  resume?: ReturnType<typeof vi.fn>;
};

function createFakeTransport({ pausable = false } = {}): FakeTransport {
  const send = vi.fn();
  const disconnect = vi.fn();
  let onMessage: ((message: JsonRpcMessage) => void) | null = null;

  const provider: JsonRpcProvider = cb => {
    onMessage = cb;

    return { send, disconnect };
  };

  const transport: FakeTransport = { provider, send, disconnect, emit: message => onMessage?.(message) };

  if (pausable) {
    transport.pause = vi.fn();
    transport.resume = vi.fn();
    Object.assign(provider, { pause: transport.pause, resume: transport.resume });
  }

  return transport;
}

// `getSyncProvider` schedules every connect attempt on a timer, and treats
// halts that land on top of each other as a flapping connection worth backing
// off from. Letting fake time run past that window keeps these cases about the
// swap rather than about the backoff.
function settle() {
  return vi.advanceTimersByTimeAsync(1_000);
}

async function connect(provider: JsonRpcProvider) {
  const messages: JsonRpcMessage[] = [];
  const connection = provider(message => messages.push(message));
  await settle();

  return { connection, messages };
}

describe('createRestartableProvider', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('builds a transport lazily and routes traffic through it', async () => {
    const transport = createFakeTransport();
    const provider = createRestartableProvider(() => transport.provider);

    const { connection, messages } = await connect(provider);
    connection.send({ jsonrpc: '2.0', id: 1, method: 'system_chain', params: [] });
    transport.emit({ jsonrpc: '2.0', id: 1, result: 'polkadot' });

    expect(transport.send).toHaveBeenCalledOnce();
    expect(messages).toContainEqual({ jsonrpc: '2.0', id: 1, result: 'polkadot' });
  });

  it('replaces the transport on restart, closing the old one exactly once', async () => {
    const first = createFakeTransport();
    const second = createFakeTransport();
    const transports = [first, second];
    const provider = createRestartableProvider(() => transports.shift()!.provider);

    await connect(provider);
    provider.restart();
    await settle();

    expect(first.disconnect).toHaveBeenCalledOnce();
    expect(second.disconnect).not.toHaveBeenCalled();
  });

  it('keeps the consumer connection alive across a restart', async () => {
    const first = createFakeTransport();
    const second = createFakeTransport();
    const transports = [first, second];
    const provider = createRestartableProvider(() => transports.shift()!.provider);

    const { connection, messages } = await connect(provider);
    provider.restart();
    await settle();

    connection.send({ jsonrpc: '2.0', id: 2, method: 'system_chain', params: [] });
    second.emit({ jsonrpc: '2.0', id: 2, result: 'kusama' });

    expect(second.send).toHaveBeenCalledOnce();
    expect(messages).toContainEqual({ jsonrpc: '2.0', id: 2, result: 'kusama' });
  });

  it('reports the active chainHead follows as stopped so the client re-follows', async () => {
    const first = createFakeTransport();
    const second = createFakeTransport();
    const transports = [first, second];
    const provider = createRestartableProvider(() => transports.shift()!.provider);

    const { connection, messages } = await connect(provider);
    connection.send({ jsonrpc: '2.0', id: 3, method: 'chainHead_v1_follow', params: [true] });
    first.emit({ jsonrpc: '2.0', id: 3, result: 'follow-1' });

    provider.restart();
    await settle();

    expect(messages).toContainEqual(
      expect.objectContaining({
        method: 'chainHead_v1_follow',
        params: { subscription: 'follow-1', result: { event: 'stop', internal: true } },
      }),
    );
  });

  it('re-establishes a legacy subscription on the new transport', async () => {
    const first = createFakeTransport();
    const second = createFakeTransport();
    const transports = [first, second];
    const provider = createRestartableProvider(() => transports.shift()!.provider);

    const { connection, messages } = await connect(provider);
    const subscribe: JsonRpcRequest = { jsonrpc: '2.0', id: 4, method: 'state_subscribeStorage', params: [['0x00']] };
    connection.send(subscribe);
    first.emit({ jsonrpc: '2.0', id: 4, result: 'sub-1' });

    provider.restart();
    await settle();

    expect(second.send).toHaveBeenCalledWith(expect.objectContaining({ method: 'state_subscribeStorage' }));

    // The consumer only ever learned `sub-1`, so notifications from the new
    // transport's id have to arrive back under the one it is routing on.
    second.emit({ jsonrpc: '2.0', id: 4, result: 'sub-2' });
    second.emit({
      jsonrpc: '2.0',
      method: 'state_storage',
      params: { subscription: 'sub-2', result: '0x01' },
    });

    expect(messages).toContainEqual(expect.objectContaining({ params: { subscription: 'sub-1', result: '0x01' } }));
    // The re-confirmation is the consumer's own subscribe id — surfacing it
    // would look like a second, unasked-for response.
    expect(messages.filter(message => 'result' in message && message.result === 'sub-2')).toHaveLength(0);
  });

  it('retries instead of wedging when the transport factory throws', async () => {
    const transport = createFakeTransport();
    const created = vi.fn(() => {
      if (created.mock.calls.length === 1) throw new Error('no WebSocket class');

      return transport.provider;
    });
    const provider = createRestartableProvider(created);

    const { connection, messages } = await connect(provider);
    connection.send({ jsonrpc: '2.0', id: 5, method: 'system_chain', params: [] });
    transport.emit({ jsonrpc: '2.0', id: 5, result: 'polkadot' });

    expect(created).toHaveBeenCalledTimes(2);
    expect(transport.send).toHaveBeenCalledOnce();
    expect(messages).toContainEqual({ jsonrpc: '2.0', id: 5, result: 'polkadot' });
  });

  it('does not replay subscriptions into a transport the factory failed to build', async () => {
    const first = createFakeTransport();
    const second = createFakeTransport();
    const transports: (FakeTransport | null)[] = [first, null, second];
    const provider = createRestartableProvider(() => {
      const next = transports.shift();
      if (!next) throw new Error('transport unavailable');

      return next.provider;
    });

    const { connection } = await connect(provider);
    const subscribe: JsonRpcRequest = { jsonrpc: '2.0', id: 6, method: 'state_subscribeStorage', params: [['0x00']] };
    connection.send(subscribe);
    first.emit({ jsonrpc: '2.0', id: 6, result: 'sub-1' });

    provider.restart();
    // Two windows: the failed attempt in between pushes the next one out by a
    // further backoff step.
    await settle();
    await settle();

    expect(second.send).toHaveBeenCalledTimes(1);
    expect(second.send).toHaveBeenCalledWith(expect.objectContaining({ method: 'state_subscribeStorage' }));
  });

  it('is a no-op before anything has connected', async () => {
    const transport = createFakeTransport();
    const created = vi.fn(() => transport.provider);
    const provider = createRestartableProvider(created);

    provider.restart();
    await connect(provider);

    expect(created).toHaveBeenCalledOnce();
  });

  it('forwards pause and resume to a pausable transport', async () => {
    const transport = createFakeTransport({ pausable: true });
    const provider = createRestartableProvider(() => transport.provider);

    await connect(provider);
    provider.pause();
    provider.resume();

    expect(transport.pause).toHaveBeenCalledOnce();
    expect(transport.resume).toHaveBeenCalledOnce();
  });

  it('pauses a transport built while paused before handing it the message callback', async () => {
    const pause = vi.fn();
    const pausedAtInvocation: boolean[] = [];
    const transport: JsonRpcProvider = Object.assign(
      () => {
        pausedAtInvocation.push(pause.mock.calls.length > 0);

        return { send: vi.fn(), disconnect: vi.fn() };
      },
      { pause, resume: vi.fn() },
    );
    const provider = createRestartableProvider(() => transport);

    provider.pause();
    await connect(provider);

    expect(pausedAtInvocation).toEqual([true]);
  });

  it('brings a transport built while paused up paused', async () => {
    const first = createFakeTransport({ pausable: true });
    const second = createFakeTransport({ pausable: true });
    const transports = [first, second];
    const provider = createRestartableProvider(() => transports.shift()!.provider);

    await connect(provider);
    provider.pause();
    provider.restart();
    await settle();

    expect(second.pause).toHaveBeenCalledOnce();
  });

  it('tolerates pause and resume on a transport that cannot pause', async () => {
    const transport = createFakeTransport();
    const provider = createRestartableProvider(() => transport.provider);

    await connect(provider);

    expect(() => {
      provider.pause();
      provider.resume();
    }).not.toThrow();
  });
});
