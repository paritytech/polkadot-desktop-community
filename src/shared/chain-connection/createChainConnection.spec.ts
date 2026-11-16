import { type JsonRpcMessage } from '@polkadot-api/json-rpc-provider';
import { type JsonRpcProvider, type PolkadotClient } from 'polkadot-api';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type ChainConnectionConfig, createChainConnection } from './createChainConnection';
import { noop } from './noop';
import { type ChainConfig, type ConnectionStatus } from './types';

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

function createTestConnection(overrides?: Partial<ChainConnectionConfig<ChainConfig>>) {
  const mockProvider = createMockProvider();
  const clientFactory = createClientFactory();

  const connection = createChainConnection<ChainConfig>({
    createProvider: () => mockProvider.provider,
    createClient: clientFactory.createClient,
    resolve: resolveClient,
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

      // Suppress the unhandled rejection from the detached .finally() promise chain
      // in createChainConnection.ts (pendingResolutions cleanup).

      const suppress = () => {};
      process.on('unhandledRejection', suppress);

      await expect(connection.lockApi(testChain('a'))).rejects.toThrow('resolve failed');

      // Let microtask queue flush so the .finally() settles
      await new Promise(r => setTimeout(r, 0));
      process.off('unhandledRejection', suppress);

      // After resolve failure with last ref released, new lock should create fresh client
      resolve.mockResolvedValue('recovered');
      const { api, unlock } = await connection.lockApi(testChain('a'));
      expect(api).toBe('recovered');
      unlock();
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
      });

      expect(() => connection.reconnect(['nothing-here'])).not.toThrow();
      expect(createProvider).not.toHaveBeenCalled();
    });

    it('skips a chain that is only waiting out destroyDelay', async () => {
      const createProvider = vi.fn(() => createMockProvider().provider);
      const connection = createChainConnection<ChainConfig>({
        createProvider,
        createClient: createClientFactory().createClient,
        resolve: resolveClient,
        destroyDelay: 10_000,
      });

      const { unlock } = await connection.lockApi(testChain('a'));
      await settle();
      unlock();

      connection.reconnect();
      await settle();

      // Nobody holds it; the destruction timer is about to discard the client,
      // so a fresh transport would be opened only to be thrown away.
      expect(createProvider).toHaveBeenCalledTimes(1);
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
});
