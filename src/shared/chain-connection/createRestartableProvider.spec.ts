import { type JsonRpcMessage, type JsonRpcRequest } from '@polkadot-api/json-rpc-provider';
import { type JsonRpcProvider } from 'polkadot-api';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { isRecord } from './brokerMessages';
import { createRestartableProvider } from './createRestartableProvider';
import { noop } from './noop';

type OnHalt = (error?: unknown) => void;

type FakeTransport = {
  provider: JsonRpcProvider;
  // Hands the transport the `onHalt` of the build it serves, as a factory of the restartable provider does.
  build(onHalt: OnHalt): JsonRpcProvider;
  // Calls the `onHalt` of the build this transport serves.
  halt(error?: unknown): void;
  send: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  emit(message: JsonRpcMessage): void;
  pause?: ReturnType<typeof vi.fn>;
  resume?: ReturnType<typeof vi.fn>;
};

type FakeTransportParams = {
  pausable?: boolean;
  // Calls `onHalt` from inside `provider(onMessage)`, as a transport whose open fails.
  haltOnOpen?: boolean;
  // Calls `onHalt` from inside `send`, as a transport whose connection drops on the first write.
  haltOnSend?: boolean;
  // `disconnect` throws, as a light client whose drain loop failed.
  failDisconnect?: boolean;
};

function createFakeTransport({
  pausable = false,
  haltOnOpen = false,
  haltOnSend = false,
  failDisconnect = false,
}: FakeTransportParams = {}): FakeTransport {
  let onHalt: OnHalt = noop;
  const send = vi.fn(() => {
    if (haltOnSend) onHalt(new Error('send failed'));
  });
  const disconnect = vi.fn(() => {
    if (failDisconnect) throw new Error('disconnect failed');
  });
  let onMessage: ((message: JsonRpcMessage) => void) | null = null;

  const provider: JsonRpcProvider = cb => {
    onMessage = cb;
    if (haltOnOpen) onHalt(new Error('open failed'));

    return { send, disconnect };
  };

  const transport: FakeTransport = {
    provider,
    build(halt) {
      onHalt = halt;

      return provider;
    },
    halt: error => onHalt(error),
    send,
    disconnect,
    emit: message => onMessage?.(message),
  };

  if (pausable) {
    transport.pause = vi.fn();
    transport.resume = vi.fn();
    Object.assign(provider, { pause: transport.pause, resume: transport.resume });
  }

  return transport;
}

// A factory that builds the given transports in order.
function buildInOrder(transports: FakeTransport[]) {
  return vi.fn((onHalt: OnHalt) => transports.shift()!.build(onHalt));
}

function isStop(message: JsonRpcMessage): boolean {
  return (
    'method' in message &&
    isRecord(message.params) &&
    isRecord(message.params['result']) &&
    message.params['result']['event'] === 'stop'
  );
}

function countSent(transport: FakeTransport, method: string): number {
  return transport.send.mock.calls.filter(([message]) => isRecord(message) && message['method'] === method).length;
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
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

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

  it('rebuilds when the transport halts', async () => {
    const first = createFakeTransport();
    const second = createFakeTransport();
    const created = buildInOrder([first, second]);
    const provider = createRestartableProvider(created);

    const { connection, messages } = await connect(provider);
    connection.send({ jsonrpc: '2.0', id: 1, method: 'chainHead_v1_follow', params: [true] });
    first.emit({ jsonrpc: '2.0', id: 1, result: 'follow-1' });
    connection.send({ jsonrpc: '2.0', id: 2, method: 'system_chain', params: [] });

    first.halt(new Error('connection lost'));

    expect(first.disconnect).toHaveBeenCalledOnce();
    expect(messages.filter(isStop)).toHaveLength(1);
    // Short of the proxy's first backoff step.
    await vi.advanceTimersByTimeAsync(400);
    expect(created).toHaveBeenCalledOnce();

    await settle();
    expect(created).toHaveBeenCalledTimes(2);
    expect(second.send).toHaveBeenCalledWith(expect.objectContaining({ id: 2, method: 'system_chain' }));
  });

  it('acts on a halt that arrives while the transport is built, without replaying', async () => {
    const first = createFakeTransport();
    const second = createFakeTransport({ haltOnOpen: true });
    const third = createFakeTransport();
    const created = buildInOrder([first, second, third]);
    const provider = createRestartableProvider(created);

    const { connection } = await connect(provider);
    connection.send({ jsonrpc: '2.0', id: 3, method: 'state_subscribeStorage', params: [['0x00']] });
    first.emit({ jsonrpc: '2.0', id: 3, result: 'sub-1' });

    provider.restart();
    await settle();

    expect(second.disconnect).toHaveBeenCalledOnce();
    expect(second.send).not.toHaveBeenCalled();

    // The halted build pushed the next one out by a further backoff step.
    await settle();
    expect(created).toHaveBeenCalledTimes(3);
    expect(countSent(third, 'state_subscribeStorage')).toBe(1);
  });

  it('does not replay subscriptions twice when a build halts from send while the proxy re-sends', async () => {
    const first = createFakeTransport();
    const second = createFakeTransport({ haltOnSend: true });
    const third = createFakeTransport();
    const provider = createRestartableProvider(buildInOrder([first, second, third]));

    const { connection } = await connect(provider);
    connection.send({ jsonrpc: '2.0', id: 3, method: 'state_subscribeStorage', params: [['0x00']] });
    first.emit({ jsonrpc: '2.0', id: 3, result: 'sub-1' });
    // Unanswered, so the proxy re-sends it to the next build.
    connection.send({ jsonrpc: '2.0', id: 4, method: 'system_chain', params: [] });

    provider.restart();
    await settle();
    await settle();

    expect(second.disconnect).toHaveBeenCalledOnce();
    expect(countSent(third, 'state_subscribeStorage')).toBe(1);
  });

  it('sends a replayed subscribe once when the build it went out on halts before answering', async () => {
    const first = createFakeTransport();
    const second = createFakeTransport();
    const third = createFakeTransport();
    const created = buildInOrder([first, second, third]);
    const provider = createRestartableProvider(created);

    const { connection, messages } = await connect(provider);
    connection.send({ jsonrpc: '2.0', id: 3, method: 'statement_subscribeStatement', params: ['any'] });
    first.emit({ jsonrpc: '2.0', id: 3, result: 'sub-1' });

    first.halt();
    await settle();
    expect(countSent(second, 'statement_subscribeStatement')).toBe(1);

    // A light client whose connect is refused halts after the replay went out.
    second.halt(new Error('connect refused'));
    await settle();
    await settle();

    expect(created).toHaveBeenCalledTimes(3);
    expect(countSent(third, 'statement_subscribeStatement')).toBe(1);

    third.emit({ jsonrpc: '2.0', id: 3, result: 'sub-3' });
    third.emit({ jsonrpc: '2.0', method: 'statement_statement', params: { subscription: 'sub-3', result: '0x01' } });

    expect(messages).toContainEqual(expect.objectContaining({ params: { subscription: 'sub-1', result: '0x01' } }));
    expect(messages.filter(message => 'id' in message && message.id === 3)).toHaveLength(1);
  });

  it('replays a subscription again once its re-sent subscribe was answered', async () => {
    const first = createFakeTransport();
    const second = createFakeTransport();
    const third = createFakeTransport();
    const fourth = createFakeTransport();
    const provider = createRestartableProvider(buildInOrder([first, second, third, fourth]));

    const { connection, messages } = await connect(provider);
    connection.send({ jsonrpc: '2.0', id: 3, method: 'statement_subscribeStatement', params: ['any'] });
    first.emit({ jsonrpc: '2.0', id: 3, result: 'sub-1' });
    first.halt();
    await settle();
    second.halt(new Error('connect refused'));
    await settle();
    await settle();
    third.emit({ jsonrpc: '2.0', id: 3, result: 'sub-3' });

    third.halt();
    await settle();
    await settle();

    expect(countSent(fourth, 'statement_subscribeStatement')).toBe(1);

    fourth.emit({ jsonrpc: '2.0', id: 3, result: 'sub-4' });
    fourth.emit({ jsonrpc: '2.0', method: 'statement_statement', params: { subscription: 'sub-4', result: '0x02' } });

    expect(messages).toContainEqual(expect.objectContaining({ params: { subscription: 'sub-1', result: '0x02' } }));
  });

  it('halts once per build', async () => {
    const first = createFakeTransport();
    const second = createFakeTransport();
    const created = buildInOrder([first, second]);
    const provider = createRestartableProvider(created);

    await connect(provider);
    first.halt();
    first.halt();
    await settle();
    await settle();

    expect(first.disconnect).toHaveBeenCalledOnce();
    expect(created).toHaveBeenCalledTimes(2);
  });

  it('ignores a halt from a replaced transport', async () => {
    const first = createFakeTransport();
    const second = createFakeTransport({ pausable: true });
    const third = createFakeTransport();
    const created = buildInOrder([first, second, third]);
    const provider = createRestartableProvider(created);

    const { connection, messages } = await connect(provider);
    provider.restart();
    await settle();
    connection.send({ jsonrpc: '2.0', id: 4, method: 'chainHead_v1_follow', params: [true] });
    second.emit({ jsonrpc: '2.0', id: 4, result: 'follow-2' });
    const timers = vi.getTimerCount();

    first.halt();

    expect(first.disconnect).toHaveBeenCalledOnce();
    expect(second.disconnect).not.toHaveBeenCalled();
    expect(messages.filter(isStop)).toHaveLength(0);
    expect(created).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(timers);

    provider.pause();
    provider.restart();

    expect(second.pause).toHaveBeenCalledOnce();
    expect(second.disconnect).toHaveBeenCalledOnce();
  });

  it('ignores a halt from a closed transport', async () => {
    const first = createFakeTransport();
    const created = buildInOrder([first]);
    const provider = createRestartableProvider(created);

    const { connection, messages } = await connect(provider);
    connection.send({ jsonrpc: '2.0', id: 5, method: 'chainHead_v1_follow', params: [true] });
    first.emit({ jsonrpc: '2.0', id: 5, result: 'follow-1' });
    connection.disconnect();
    const timers = vi.getTimerCount();

    first.halt();

    expect(messages.filter(isStop)).toHaveLength(0);
    expect(created).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(timers);
  });

  it('halts even when closing the connection throws', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(noop);
    const first = createFakeTransport({ failDisconnect: true });
    const second = createFakeTransport({ failDisconnect: true, haltOnOpen: true });
    const third = createFakeTransport();
    const created = buildInOrder([first, second, third]);
    const provider = createRestartableProvider(created);

    const { connection } = await connect(provider);
    expect(() => first.halt()).not.toThrow();
    // Buffered by the proxy while it is between transports.
    connection.send({ jsonrpc: '2.0', id: 6, method: 'system_chain', params: [] });
    await settle();
    await settle();

    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ message: 'disconnect failed' }));
    expect(created).toHaveBeenCalledTimes(3);
    expect(third.send).toHaveBeenCalledWith(expect.objectContaining({ id: 6, method: 'system_chain' }));
  });

  it('restarts even when closing the connection throws', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(noop);
    const first = createFakeTransport({ failDisconnect: true });
    const second = createFakeTransport();
    const created = buildInOrder([first, second]);
    const provider = createRestartableProvider(created);

    await connect(provider);
    expect(() => provider.restart()).not.toThrow();
    // Short of the proxy's first backoff step.
    await vi.advanceTimersByTimeAsync(400);
    expect(created).toHaveBeenCalledOnce();
    await settle();

    expect(warn).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ message: 'disconnect failed' }));
    expect(created).toHaveBeenCalledTimes(2);
  });
});
