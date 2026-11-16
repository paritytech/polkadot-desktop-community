import { type JsonRpcConnection, type JsonRpcMessage, type JsonRpcRequest } from '@polkadot-api/json-rpc-provider';
import { type JsonRpcProvider, type PolkadotClient } from 'polkadot-api';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CHAIN_HEAD_FOLLOW, isRecord } from './brokerMessages';
import { type ChainConnectionConfig, createChainConnection } from './createChainConnection';
import { noop } from './noop';
import { type ChainConfig, type ConnectionStatus } from './types';

const FOLLOW_LIMIT = 4;

// An in-memory stand-in for polkadot-api's `createClient`: one client object per
// call, each counting its own `destroy()`.
function createClientFactory() {
  const clients: { destroyed: number }[] = [];

  const createClient: ChainConnectionConfig<ChainConfig>['createClient'] = provider => {
    const client = { destroyed: 0 };
    clients.push(client);
    // The real one connects up front and drops the connection on destroy; the
    // pool only builds a transport once something actually connects.
    const connection = provider(noop);

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- PolkadotClient has dozens of members; the pool only calls destroy()
    return {
      destroy: () => {
        client.destroyed++;
        connection.disconnect();
      },
    } as unknown as PolkadotClient;
  };

  return { createClient, last: () => clients[clients.length - 1]! };
}

function resolveClient(_chain: ChainConfig, client: PolkadotClient) {
  return Promise.resolve(client);
}

// The transport is built on the proxy's first connect attempt, which it
// schedules rather than runs inline.
function connected() {
  return new Promise(resolve => setTimeout(resolve, 0));
}

function createMockProvider() {
  const send = vi.fn();
  const disconnect = vi.fn();
  let onMessage: ((msg: JsonRpcMessage) => void) | null = null;

  const provider: JsonRpcProvider = cb => {
    onMessage = cb;

    return { send, disconnect };
  };

  return { provider, send, disconnect, simulateMessage: (msg: JsonRpcMessage) => onMessage?.(msg) };
}

function testChain(id: string): ChainConfig {
  return { genesisHash: id };
}

const SYSTEM_NAME = 'system_name';
const CHAIN_HEAD_HEADER = 'chainHead_v1_header';

type CreateProvider = ChainConnectionConfig<ChainConfig>['createProvider'];

type FakeTransport = {
  // What the pool sent the node, in order.
  sent: JsonRpcRequest[];
  // What the pool did to the transport, in order: `pause`, `resume`, `open` and `disconnect`.
  calls: string[];
};

type TransportsParams = {
  // The first transport's build throws.
  failFirstBuild?: boolean;
  // The first transport's pause throws.
  failFirstPause?: boolean;
  // The second transport, the first build of lane 1, fails its open and halts.
  haltSecondOpen?: boolean;
};

// Fake transports that answer as the node: a fresh token for a follow, `'node'` for `system_name`. Each reports
// `connecting` as it is built and `connected` as it opens.
function createTransports({ failFirstBuild = false, failFirstPause = false, haltSecondOpen = false }: TransportsParams = {}) {
  const built: FakeTransport[] = [];
  let builds = 0;
  let nextToken = 0;

  const createProvider = vi.fn<CreateProvider>((_chain, onStatusChanged, onHalt) => {
    builds += 1;
    if (failFirstBuild && builds === 1) {
      throw new Error('transport factory failed');
    }
    const transport: FakeTransport = { sent: [], calls: [] };
    built.push(transport);
    onStatusChanged('connecting');

    const haltsOnOpen = haltSecondOpen && builds === 2;

    function provider(onMessage: (message: JsonRpcMessage) => void): JsonRpcConnection {
      transport.calls.push('open');
      if (haltsOnOpen) {
        onStatusChanged('disconnected');
        onHalt(new Error('open failed'));
      } else {
        onStatusChanged('connected');
      }
      return {
        send(message) {
          transport.sent.push(message);
          if (message.id === undefined) {
            return;
          }
          if (message.method === CHAIN_HEAD_FOLLOW) {
            onMessage({ jsonrpc: '2.0', id: message.id, result: `follow-${String(nextToken)}` });
            nextToken += 1;
          } else if (message.method === SYSTEM_NAME) {
            onMessage({ jsonrpc: '2.0', id: message.id, result: 'node' });
          }
        },
        disconnect() {
          transport.calls.push('disconnect');
        },
      };
    }

    return Object.assign(provider, {
      pause() {
        transport.calls.push('pause');
        if (failFirstPause && transport === built[0]) {
          throw new Error('pause failed');
        }
      },
      resume() {
        transport.calls.push('resume');
      },
    });
  });

  return { createProvider, built };
}

function listSent(transport: FakeTransport | undefined, method: string): JsonRpcRequest[] {
  return (transport?.sent ?? []).filter(message => message.method === method);
}

type Pool = ReturnType<typeof createChainConnection<ChainConfig>>;

type Consumer = {
  connection: JsonRpcConnection;
  // What the consumer heard, in order.
  heard: JsonRpcMessage[];
};

function createLanePool(overrides: Partial<ChainConnectionConfig<ChainConfig>> = {}, transports = createTransports()) {
  const clients = createClientFactory();
  const pool = createChainConnection<ChainConfig>({
    createProvider: transports.createProvider,
    createClient: clients.createClient,
    resolve: resolveClient,
    followLimit: () => FOLLOW_LIMIT,
    ...overrides,
  });

  return { pool, transports, clients };
}

function connectConsumer(pool: Pool, chain: ChainConfig): Consumer {
  const heard: JsonRpcMessage[] = [];
  const connection = pool.getProvider(chain)(message => {
    heard.push(message);
  });

  return { connection, heard };
}

function follow(consumer: Consumer, id: string): void {
  consumer.connection.send({ jsonrpc: '2.0', id, method: CHAIN_HEAD_FOLLOW, params: [false] });
}

function readAnswers(consumer: Consumer, id: string): unknown[] {
  return consumer.heard.flatMap(message => ('result' in message && message.id === id ? [message.result] : []));
}

function heardStop(consumer: Consumer): boolean {
  return consumer.heard.some(
    message =>
      'method' in message &&
      isRecord(message.params) &&
      isRecord(message.params['result']) &&
      message.params['result']['event'] === 'stop',
  );
}

function createTestConnection(overrides?: Partial<ChainConnectionConfig<ChainConfig>>) {
  const mockProvider = createMockProvider();
  const clientFactory = createClientFactory();

  const connection = createChainConnection<ChainConfig>({
    createProvider: () => mockProvider.provider,
    createClient: clientFactory.createClient,
    resolve: resolveClient,
    followLimit: () => FOLLOW_LIMIT,
    ...overrides,
  });

  return { connection, mockProvider, clients: clientFactory };
}

describe('createChainConnection', () => {
  describe('lockApi', () => {
    it('returns api and unlock function', async () => {
      const { connection } = createTestConnection();
      const { api, unlock } = await connection.lockApi(testChain('a'));

      expect(api).toBeDefined();
      expect(typeof unlock).toBe('function');
      unlock();
    });

    it('reuses client for same chainId', async () => {
      const { connection } = createTestConnection();
      const chain = testChain('a');

      const { api: api1, unlock: u1 } = await connection.lockApi(chain);
      const { api: api2, unlock: u2 } = await connection.lockApi(chain);

      expect(api1).toBe(api2);
      u1();
      u2();
    });

    it('creates separate clients for different chains', async () => {
      const { connection } = createTestConnection();

      const { api: api1, unlock: u1 } = await connection.lockApi(testChain('a'));
      const { api: api2, unlock: u2 } = await connection.lockApi(testChain('b'));

      expect(api1).not.toBe(api2);
      u1();
      u2();
    });
  });

  describe('lockApi — with resolve', () => {
    it('calls resolve with chain and polkadotClient', async () => {
      const resolve = vi.fn().mockResolvedValue('resolved-api');
      const { connection } = createTestConnection({ resolve });
      const chain = testChain('a');

      const { api, unlock } = await connection.lockApi(chain);

      expect(api).toBe('resolved-api');
      expect(resolve).toHaveBeenCalledWith(chain, expect.anything());
      unlock();
    });

    it('caches resolved api for subsequent calls', async () => {
      const resolve = vi.fn().mockResolvedValue('resolved-api');
      const { connection } = createTestConnection({ resolve });
      const chain = testChain('a');

      const { unlock: u1 } = await connection.lockApi(chain);
      const { unlock: u2 } = await connection.lockApi(chain);

      expect(resolve).toHaveBeenCalledTimes(1);
      u1();
      u2();
    });

    it('deduplicates concurrent resolutions', async () => {
      const resolve = vi.fn().mockImplementation(() => new Promise(r => setTimeout(() => r('resolved-api'), 10)));
      const { connection } = createTestConnection({ resolve });
      const chain = testChain('a');

      const [r1, r2] = await Promise.all([connection.lockApi(chain), connection.lockApi(chain)]);

      expect(resolve).toHaveBeenCalledTimes(1);
      r1.unlock();
      r2.unlock();
    });
  });

  describe('lockApi — error handling', () => {
    it('throws when resolve rejects and calls unlock', async () => {
      const resolve = vi.fn().mockRejectedValue(new Error('resolve failed'));
      const { connection } = createTestConnection({ resolve });

      await expect(connection.lockApi(testChain('a'))).rejects.toThrow('resolve failed');

      // After resolve failure with last ref released, new lock should create fresh client
      resolve.mockResolvedValue('recovered');
      const { api, unlock } = await connection.lockApi(testChain('a'));
      expect(api).toBe('recovered');
      unlock();
    });

    it('leaves no unhandled rejection when resolve fails', async () => {
      const error = new Error('resolve failed');
      const failingResolve = vi.fn().mockRejectedValueOnce(error);
      const { connection } = createTestConnection({ resolve: failingResolve });
      const listener = vi.fn();
      process.on('unhandledRejection', listener);

      await expect(connection.lockApi(testChain('a'))).rejects.toBe(error);
      // Node reports an unhandled rejection only after the microtasks drain, so a macrotask has to pass first.
      await new Promise(resolve => setTimeout(resolve, 0));
      process.off('unhandledRejection', listener);

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('status / onStatusChanged', () => {
    it('returns disconnected for unknown chain', () => {
      const { connection } = createTestConnection();
      expect(connection.status('unknown')).toBe('disconnected');
    });

    it('reflects status from createProvider callback', async () => {
      let statusCb: ((status: ConnectionStatus) => void) | undefined;
      const { connection } = createTestConnection({
        createProvider: (_chain, onStatusChanged) => {
          statusCb = onStatusChanged;
          return createMockProvider().provider;
        },
      });

      // The lock is held across the wait: releasing it destroys the client, and
      // a destroyed pool never gets round to building a transport at all.
      const { unlock } = await connection.lockApi(testChain('a'));
      await connected();

      statusCb!('connected');
      expect(connection.status('a')).toBe('connected');
      unlock();
    });

    it('onStatusChanged returns unsubscribe function', async () => {
      let statusCb: ((status: ConnectionStatus) => void) | undefined;
      const { connection } = createTestConnection({
        createProvider: (_chain, onStatusChanged) => {
          statusCb = onStatusChanged;
          return createMockProvider().provider;
        },
      });

      const { unlock } = await connection.lockApi(testChain('a'));
      await connected();

      const callback = vi.fn();
      const unsub = connection.onStatusChanged('a', callback);

      statusCb!('connected');
      expect(callback).toHaveBeenCalledWith('connected');

      unsub();
      callback.mockClear();
      statusCb!('disconnected');
      expect(callback).not.toHaveBeenCalled();
      unlock();
    });
  });

  describe('lockApi — connection lifecycle', () => {
    it('destroys client synchronously when last lock is released (no destroyDelay)', async () => {
      const { connection, clients } = createTestConnection();
      const { unlock } = await connection.lockApi(testChain('a'));

      unlock();
      expect(clients.last().destroyed).toBe(1);
    });

    it('does not destroy while any lock is still held', async () => {
      const { connection, clients } = createTestConnection();
      const chain = testChain('a');
      const { unlock: u1 } = await connection.lockApi(chain);
      const { unlock: u2 } = await connection.lockApi(chain);

      u1();
      expect(clients.last().destroyed).toBe(0);

      u2();
      expect(clients.last().destroyed).toBe(1);
    });

    describe('with destroyDelay', () => {
      beforeEach(() => {
        vi.useFakeTimers();
      });
      afterEach(() => {
        vi.useRealTimers();
      });

      it('defers destruction by destroyDelay ms', async () => {
        const { connection, clients } = createTestConnection({ destroyDelay: 1000 });
        const { unlock } = await connection.lockApi(testChain('a'));

        unlock();
        expect(clients.last().destroyed).toBe(0);

        vi.advanceTimersByTime(1000);
        expect(clients.last().destroyed).toBe(1);
      });

      it('cancels destruction timer when connection is re-acquired before delay elapses', async () => {
        const { connection, clients } = createTestConnection({ destroyDelay: 1000 });
        const chain = testChain('a');

        const { api: api1, unlock: u1 } = await connection.lockApi(chain);
        u1();

        // Re-acquire before timer fires — same client must be returned, no destruction
        const { api: api2, unlock: u2 } = await connection.lockApi(chain);

        vi.advanceTimersByTime(1000);
        expect(clients.last().destroyed).toBe(0);
        expect(api1).toBe(api2);

        u2();
      });
    });
  });

  describe('pauseAll / resumeAll', () => {
    const createPausableMockProvider = () => {
      const pause = vi.fn();
      const resume = vi.fn();
      const provider: JsonRpcProvider = Object.assign(() => ({ send: vi.fn(), disconnect: vi.fn() }), {
        pause,
        resume,
      });

      return { provider, pause, resume };
    };

    it('calls pause on every pausable provider created so far', async () => {
      const chainA = createPausableMockProvider();
      const chainB = createPausableMockProvider();
      const providerByChain: Record<string, JsonRpcProvider> = { a: chainA.provider, b: chainB.provider };

      const connection = createChainConnection<ChainConfig>({
        createProvider: chain => providerByChain[chain.genesisHash]!,
        createClient: createClientFactory().createClient,
        resolve: resolveClient,
        followLimit: () => FOLLOW_LIMIT,
      });

      const { unlock: u1 } = await connection.lockApi(testChain('a'));
      const { unlock: u2 } = await connection.lockApi(testChain('b'));
      await connected();

      connection.pauseAll();

      expect(chainA.pause).toHaveBeenCalledTimes(1);
      expect(chainB.pause).toHaveBeenCalledTimes(1);

      u1();
      u2();
    });

    it('calls resume on every pausable provider', async () => {
      const chainA = createPausableMockProvider();

      const connection = createChainConnection<ChainConfig>({
        createProvider: () => chainA.provider,
        createClient: createClientFactory().createClient,
        resolve: resolveClient,
        followLimit: () => FOLLOW_LIMIT,
      });
      const { unlock } = await connection.lockApi(testChain('a'));
      await connected();

      connection.pauseAll();
      connection.resumeAll();

      expect(chainA.resume).toHaveBeenCalledTimes(1);
      unlock();
    });

    it('skips non-pausable providers without preventing pause on the rest', async () => {
      // Mixed pool: 'a' is non-pausable, 'b' is pausable. The pausable one must
      // still receive pause/resume even though the other is silently skipped.
      const pausable = createPausableMockProvider();
      const connection = createChainConnection<ChainConfig>({
        createProvider: c => (c.genesisHash === 'b' ? pausable.provider : createMockProvider().provider),
        createClient: createClientFactory().createClient,
        resolve: resolveClient,
        followLimit: () => FOLLOW_LIMIT,
      });
      await connection.lockApi(testChain('a'));
      await connection.lockApi(testChain('b'));
      await connected();

      connection.pauseAll();
      connection.resumeAll();

      expect(pausable.pause).toHaveBeenCalledTimes(1);
      expect(pausable.resume).toHaveBeenCalledTimes(1);
    });

    it('does not call pause on providers for chains that have been destroyed', async () => {
      const chainA = createPausableMockProvider();
      const connection = createChainConnection<ChainConfig>({
        createProvider: () => chainA.provider,
        createClient: createClientFactory().createClient,
        resolve: resolveClient,
        followLimit: () => FOLLOW_LIMIT,
        destroyDelay: 0,
      });

      const { unlock } = await connection.lockApi(testChain('a'));
      unlock();

      connection.pauseAll();
      expect(chainA.pause).not.toHaveBeenCalled();
    });
  });
  describe('reconnect', () => {
    // A restart rides the proxy's halt path, which backs off when halts land on
    // top of each other. Running fake time past that window keeps these cases
    // about the swap rather than about the backoff.
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    const settle = () => vi.advanceTimersByTimeAsync(1_000);

    it('asks createProvider for a new transport and closes the old one', async () => {
      const first = createMockProvider();
      const second = createMockProvider();
      const transports = [first, second];
      const createProvider = vi.fn(() => transports.shift()!.provider);

      const { connection } = createTestConnection({ createProvider });
      const { unlock } = await connection.lockApi(testChain('a'));
      await settle();

      connection.reconnect();
      await settle();

      expect(createProvider).toHaveBeenCalledTimes(2);
      expect(first.disconnect).toHaveBeenCalledTimes(1);
      unlock();
    });

    it('keeps the pooled client — the point is not restarting the app', async () => {
      const { connection, clients } = createTestConnection();
      const { api, unlock } = await connection.lockApi(testChain('a'));
      await settle();

      connection.reconnect();
      await settle();

      const { api: after, unlock: unlockAfter } = await connection.lockApi(testChain('a'));

      expect(clients.last().destroyed).toBe(0);
      expect(after).toBe(api);
      unlock();
      unlockAfter();
    });

    it('rebuilds only the chains it was given', async () => {
      const built: string[] = [];
      const connection = createChainConnection<ChainConfig>({
        createProvider: chain => {
          built.push(chain.genesisHash);

          return createMockProvider().provider;
        },
        createClient: createClientFactory().createClient,
        resolve: resolveClient,
        followLimit: () => FOLLOW_LIMIT,
      });

      const { unlock: unlockA } = await connection.lockApi(testChain('a'));
      const { unlock: unlockB } = await connection.lockApi(testChain('b'));
      await settle();
      expect(built).toEqual(['a', 'b']);

      connection.reconnect(['a']);
      await settle();

      expect(built).toEqual(['a', 'b', 'a']);
      unlockA();
      unlockB();
    });

    it('ignores a chain the pool is not holding', async () => {
      const createProvider = vi.fn(() => createMockProvider().provider);
      const connection = createChainConnection<ChainConfig>({
        createProvider,
        createClient: createClientFactory().createClient,
        resolve: resolveClient,
        followLimit: () => FOLLOW_LIMIT,
      });

      expect(() => connection.reconnect(['nothing-here'])).not.toThrow();
      expect(createProvider).not.toHaveBeenCalled();
    });

    it('closes a chain waiting out destroyDelay on reconnect, and builds the new transport on its next acquire', async () => {
      const first = createMockProvider();
      const second = createMockProvider();
      const providers = [first, second];
      const createProvider = vi.fn(() => providers.shift()!.provider);
      const clients = createClientFactory();
      const connection = createChainConnection<ChainConfig>({
        createProvider,
        createClient: clients.createClient,
        resolve: resolveClient,
        followLimit: () => FOLLOW_LIMIT,
        destroyDelay: 10_000,
      });

      const { unlock } = await connection.lockApi(testChain('a'));
      await settle();
      unlock();

      connection.reconnect();
      expect(first.disconnect).toHaveBeenCalledTimes(1);

      const { unlock: unlockAgain } = await connection.lockApi(testChain('a'));
      await settle();
      expect(createProvider).toHaveBeenCalledTimes(2);

      await vi.advanceTimersByTimeAsync(10_000);
      expect(clients.last().destroyed).toBe(0);
      unlockAgain();
    });

    it('drops a status the replaced transport reports after the swap', async () => {
      const statusCallbacks: ((status: ConnectionStatus) => void)[] = [];
      const { connection } = createTestConnection({
        createProvider: (_chain, onStatusChanged) => {
          statusCallbacks.push(onStatusChanged);

          return createMockProvider().provider;
        },
      });

      const { unlock } = await connection.lockApi(testChain('a'));
      await settle();

      connection.reconnect();
      await settle();

      statusCallbacks[1]!('connected');
      // The transport that was replaced has no say any more — otherwise its
      // parting 'disconnected' would land on top of its successor's 'connected'.
      statusCallbacks[0]!('disconnected');

      expect(connection.status('a')).toBe('connected');
      unlock();
    });
  });

  // A `getProvider` consumer's session opens only after `getSyncProvider`'s zero-delay timer and the lease's microtask,
  // so every case lets both run before anything follows.
  describe('on lanes', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    const chain = testChain('a');

    it('answers each consumer under its own id', async () => {
      const { pool, transports } = createLanePool();
      const first = connectConsumer(pool, chain);
      const second = connectConsumer(pool, chain);
      await vi.runAllTimersAsync();

      first.connection.send({ jsonrpc: '2.0', id: 'truapi:1', method: SYSTEM_NAME, params: [] });
      second.connection.send({ jsonrpc: '2.0', id: 'truapi:1', method: SYSTEM_NAME, params: [] });
      await vi.runAllTimersAsync();

      expect(readAnswers(first, 'truapi:1')).toEqual(['node']);
      expect(readAnswers(second, 'truapi:1')).toEqual(['node']);
      // Under one id the node's two answers could not be told apart.
      const upstreamIds = transports.built.flatMap(transport => listSent(transport, SYSTEM_NAME).map(request => request.id));
      expect(new Set(upstreamIds).size).toBe(2);
    });

    it('opens a second transport for a follow past the limit', async () => {
      const { pool, transports } = createLanePool({ followLimit: () => 2 });
      const first = connectConsumer(pool, chain);
      const second = connectConsumer(pool, chain);
      const third = connectConsumer(pool, chain);
      await vi.runAllTimersAsync();

      follow(first, 'follow-1');
      follow(second, 'follow-2');
      follow(third, 'follow-3');
      await vi.runAllTimersAsync();
      const [token] = readAnswers(third, 'follow-3');
      third.connection.send({ jsonrpc: '2.0', id: 'header-3', method: CHAIN_HEAD_HEADER, params: [token, '0x00'] });
      await vi.runAllTimersAsync();

      expect(transports.createProvider).toHaveBeenCalledTimes(2);
      expect(listSent(transports.built[1], CHAIN_HEAD_HEADER)).toHaveLength(1);
    });

    it('places a re-follow after reconnect under the limit it returns then', async () => {
      let limit = 1;
      const { pool, transports } = createLanePool({ followLimit: () => limit });
      const a = connectConsumer(pool, chain);
      const b = connectConsumer(pool, chain);
      await vi.runAllTimersAsync();
      follow(a, 'a-1');
      follow(b, 'b-1');
      await vi.runAllTimersAsync();
      expect(transports.built).toHaveLength(2);

      limit = 4;
      pool.reconnect();
      await vi.runAllTimersAsync();

      expect(heardStop(a)).toBe(true);
      expect(heardStop(b)).toBe(true);
      follow(a, 'a-2');
      follow(b, 'b-2');
      await vi.runAllTimersAsync();

      // Both lanes were rebuilt in lane order, and the re-follows went home to lane 0, which has room again.
      const rebuilt = transports.built.slice(2);
      expect(rebuilt).toHaveLength(2);
      expect(listSent(rebuilt[0], CHAIN_HEAD_FOLLOW)).toHaveLength(2);
      expect(listSent(rebuilt[1], CHAIN_HEAD_FOLLOW)).toHaveLength(0);
    });

    it('pauses every chain even when one chain throws', async () => {
      const { pool, transports } = createLanePool({}, createTransports({ failFirstPause: true }));
      connectConsumer(pool, testChain('a'));
      connectConsumer(pool, testChain('b'));
      await vi.runAllTimersAsync();

      expect(() => {
        pool.pauseAll();
      }).toThrow('pause failed');
      expect(transports.built).toHaveLength(2);
      expect(transports.built[1]?.calls).toContain('pause');
    });

    it('closes the lanes of a chain whose client cannot be made, and reports it disconnected', async () => {
      const transports = createTransports();
      const failure = new Error('client refused');
      const { pool } = createLanePool(
        {
          createClient: provider => {
            provider(noop);
            throw failure;
          },
        },
        transports,
      );
      const statuses: ConnectionStatus[] = [];
      pool.onStatusChanged(chain.genesisHash, status => {
        statuses.push(status);
      });

      await expect(pool.lockApi(chain)).rejects.toBe(failure);
      await vi.runAllTimersAsync();

      expect(pool.status(chain.genesisHash)).toBe('disconnected');
      expect(statuses.at(-1)).toBe('disconnected');
      for (const transport of transports.built) {
        expect(transport.calls.at(-1)).toBe('disconnect');
      }
    });

    it('brings a lane up paused while the pool is paused', async () => {
      const { pool, transports } = createLanePool({ followLimit: () => 1 });
      pool.pauseAll();
      const a = connectConsumer(pool, chain);
      const b = connectConsumer(pool, chain);
      await vi.runAllTimersAsync();
      follow(a, 'a-1');
      follow(b, 'b-1');
      await vi.runAllTimersAsync();

      expect(transports.built.map(transport => transport.calls.slice(0, 2))).toEqual([
        ['pause', 'open'],
        ['pause', 'open'],
      ]);
    });

    it('reports connecting while a new chain opens', async () => {
      const { pool } = createLanePool();
      const statuses: ConnectionStatus[] = [];
      pool.onStatusChanged(chain.genesisHash, status => {
        statuses.push(status);
      });

      connectConsumer(pool, chain);
      // Fires only the consumer's zero-delay connect, which takes the lease and builds the chain.
      vi.runOnlyPendingTimers();
      expect(pool.status(chain.genesisHash)).toBe('connecting');

      await vi.runAllTimersAsync();
      expect(statuses).toEqual(['connecting', 'connected']);
    });

    it('returns the lease of a provider torn down before it connects', async () => {
      const { pool, transports, clients } = createLanePool({ destroyDelay: 60_000 });
      const connection = pool.getProvider(chain)(noop);
      // Fires only the zero-delay connect: the lease is taken, and its `.then` is still queued.
      vi.runOnlyPendingTimers();
      connection.disconnect();
      await vi.runAllTimersAsync();

      expect(transports.createProvider).toHaveBeenCalled();
      expect(transports.built.every(transport => transport.calls.includes('disconnect'))).toBe(true);
      // A second lease would have cancelled the destruction timer.
      expect(clients.last().destroyed).toBe(1);
    });

    it('does not retry a provider torn down before its failed acquire settles', async () => {
      const clients = createClientFactory();
      const createClient = vi.fn(clients.createClient).mockImplementationOnce(() => {
        throw new Error('client build failed');
      });
      const { pool } = createLanePool({ createClient });
      const connection = pool.getProvider(chain)(noop);
      // Fires only the zero-delay connect: the acquire has thrown, and its `.catch` is still queued.
      vi.runOnlyPendingTimers();
      connection.disconnect();
      await vi.runAllTimersAsync();

      expect(createClient).toHaveBeenCalledTimes(1);

      // With no lease left, the next holder builds a fresh client and its release destroys it at once.
      const { unlock } = await pool.lockApi(chain);
      unlock();
      expect(createClient).toHaveBeenCalledTimes(2);
      expect(clients.last().destroyed).toBe(1);
    });

    it('reports disconnected for a lane whose transport factory throws, and recovers', async () => {
      const { pool } = createLanePool({}, createTransports({ failFirstBuild: true }));
      const statuses: ConnectionStatus[] = [];
      pool.onStatusChanged(chain.genesisHash, status => {
        statuses.push(status);
      });

      connectConsumer(pool, chain);
      // Short of the proxy's retry backoff.
      await vi.advanceTimersByTimeAsync(100);
      expect(pool.status(chain.genesisHash)).toBe('disconnected');

      await vi.advanceTimersByTimeAsync(1_000);
      expect(pool.status(chain.genesisHash)).toBe('connected');
      expect(statuses).toEqual(['connecting', 'disconnected', 'connecting', 'connected']);
    });

    it('heals a lane whose transport halts', async () => {
      const { pool, transports } = createLanePool({ followLimit: () => 2 }, createTransports({ haltSecondOpen: true }));
      const first = connectConsumer(pool, chain);
      const second = connectConsumer(pool, chain);
      const third = connectConsumer(pool, chain);
      await vi.runAllTimersAsync();

      follow(first, 'follow-1');
      follow(second, 'follow-2');
      follow(third, 'follow-3');
      await vi.runAllTimersAsync();

      expect(transports.built).toHaveLength(3);
      expect(transports.built[1]!.calls).toEqual(['open', 'disconnect']);
      expect(listSent(transports.built[2], CHAIN_HEAD_FOLLOW)).toHaveLength(1);
      expect(readAnswers(third, 'follow-3')).toHaveLength(1);
      expect(pool.status(chain.genesisHash)).toBe('connected');
    });

    it('closes every lane when the chain is destroyed', async () => {
      const { pool, transports, clients } = createLanePool({ followLimit: () => 1, destroyDelay: 1_000 });
      const a = connectConsumer(pool, chain);
      const b = connectConsumer(pool, chain);
      await vi.runAllTimersAsync();
      follow(a, 'a-1');
      follow(b, 'b-1');
      await vi.runAllTimersAsync();

      a.connection.disconnect();
      b.connection.disconnect();
      await vi.runAllTimersAsync();

      expect(transports.built).toHaveLength(2);
      expect(transports.built.every(transport => transport.calls.includes('disconnect'))).toBe(true);
      expect(clients.last().destroyed).toBe(1);
    });
  });
});
