import { BehaviorSubject, firstValueFrom } from 'rxjs';
import * as v from 'valibot';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type ChainActivity, type ChainPoolWatcher } from '@/shared/chain-connection';
import { resetExecutionEnvironment } from '@/shared/execution-environment';
import { type Chain, type ChainLifecycle, type GenesisHash, genesisHash, networkMonitorService } from '@/domains/network';

import { networkMonitorUseCase } from './networkMonitorUseCase';
import { networkMonitor } from './state/networkMonitor';

type LifecycleListener = (genesisHash: GenesisHash, lifecycle: ChainLifecycle | null) => void;

const RELAY = buildChain('Relay', `0x${'01'.repeat(32)}`);
const ASSET_HUB = buildChain('Asset Hub', `0x${'02'.repeat(32)}`);
const BULLETIN = buildChain('Bulletin', `0x${'03'.repeat(32)}`);
const PEOPLE: Chain = { ...buildChain('People', `0x${'04'.repeat(32)}`), parentId: RELAY.genesisHash };
const OTHER = buildChain('Other', `0x${'05'.repeat(32)}`);

const ENVIRONMENT = { peopleChain: PEOPLE, bulletinChain: BULLETIN, dotnsChain: ASSET_HUB };

const ACTIVE_CHAINS: Chain[] = [RELAY, ASSET_HUB, BULLETIN, PEOPLE];

const poolWatchers = new Set<ChainPoolWatcher<Chain>>();
const lifecycleListeners = new Set<LifecycleListener>();
const stops: VoidFunction[] = [];
let online$: BehaviorSubject<boolean>;
let visible$: BehaviorSubject<boolean>;
let getCatalog: () => Promise<Chain[]>;

beforeEach(() => {
  vi.useFakeTimers();
  poolWatchers.clear();
  lifecycleListeners.clear();
  online$ = new BehaviorSubject(true);
  visible$ = new BehaviorSubject(true);
  getCatalog = () => Promise.resolve([RELAY, ASSET_HUB, BULLETIN, PEOPLE, OTHER]);
});

afterEach(() => {
  for (const stop of stops.splice(0)) {
    stop();
  }
  vi.useRealTimers();
});

describe('The network health store', () => {
  it('As a user, I start using every chain and see syncing until each pool connects, then connected', async () => {
    // Given
    await startHealth();

    // When
    useAll({ status: 'connecting' });
    const connecting = networkMonitor.health.get();
    useAll();

    // Then
    expect([connecting, networkMonitor.health.get()]).toEqual(['syncing', 'connected']);
  });

  it('As a user whose chains stop producing blocks, I wait and see degraded without any new event', async () => {
    // Given
    await startHealth();
    useAll();
    blockAll(100);

    // When
    await vi.advanceTimersByTimeAsync(getEveryChainOverdueMs());

    // Then
    expect(networkMonitor.health.get()).toBe('unstable');
  });

  it('As a user, I get a later block and see the health recheck when the fastest chain is overdue from that block', async () => {
    // Given
    await startHealth();
    useAll();
    const fastest = Math.min(...readBlockTimes());
    const overdue = fastest * 3;
    blockAll(100);

    // When a block arrives later, moving the overdue time, and the clock reaches it and then passes it
    await vi.advanceTimersByTimeAsync(1000);
    blockAll(101);
    await vi.advanceTimersByTimeAsync(overdue - 1);
    const justBefore = networkMonitor.health.get();
    await vi.advanceTimersByTimeAsync(2);

    // Then
    expect([justBefore, networkMonitor.health.get()]).toEqual(['connected', 'unstable']);
  });

  it('As a user in another tab, I come back to the tab and see the health rechecked only then', async () => {
    // Given
    await startHealth();
    useAll();
    blockAll(100);

    // When
    visible$.next(false);
    await vi.advanceTimersByTimeAsync(getEveryChainOverdueMs());
    const pendingWhileHidden = vi.getTimerCount();
    const whileHidden = networkMonitor.health.get();
    visible$.next(true);

    // Then
    expect({ pendingWhileHidden, whileHidden, shown: networkMonitor.health.get() }).toEqual({
      pendingWhileHidden: 0,
      whileHidden: 'connected',
      shown: 'unstable',
    });
  });

  it('As a user before any chain exists, I go offline and back and see each at once', async () => {
    // Given
    await startHealth();

    // When
    online$.next(false);
    const offline = networkMonitor.health.get();
    online$.next(true);

    // Then
    expect([offline, networkMonitor.health.get()]).toEqual(['offline', 'unused']);
  });

  it('As a user who went offline while the page booted, I wait for the network health to start and see it turn red', async () => {
    // Given a page that went offline before the health started
    online$.next(false);

    // When
    await startHealth();

    // Then
    expect(networkMonitor.health.get()).toBe('offline');
  });

  it('As a user leaving the page, I stop the health store and later activity changes nothing', async () => {
    // Given
    const stop = await startHealth();
    const listenersWhileRunning = poolWatchers.size;

    // When
    stop();
    networkMonitor.model.set(model => networkMonitorService.recordChainActivity(model, buildActivity(PEOPLE, {})));

    // Then: the pool watch is released, and the health stays as the stopped loop left it
    expect({
      listenersWhileRunning,
      listenersAfterStop: poolWatchers.size,
      health: networkMonitor.health.get(),
    }).toEqual({
      listenersWhileRunning: 1,
      listenersAfterStop: 0,
      health: 'unused',
    });
  });

  it('As a user whose only live chain is released, I wait past its recheck and the indicator never turns unstable', async () => {
    // Given
    await startHealth();
    tellActivity(buildActivity(RELAY, {}));
    tellBestBlock(RELAY.genesisHash, 100);
    const live = networkMonitor.health.get();

    // When
    tellActivity(buildActivity(RELAY, { consumers: 0 }));
    await vi.advanceTimersByTimeAsync(60_000);

    // Then
    expect({ live, released: networkMonitor.health.get(), pending: vi.getTimerCount() }).toEqual({
      live: 'connected',
      released: 'unused',
      pending: 0,
    });
  });

  it('As an execution environment reset during a follow, I leave the health unused', async () => {
    // Given
    await startHealth();
    useAll();
    blockAll(100);

    // When
    resetExecutionEnvironment();

    // Then
    expect(networkMonitor.health.get()).toBe('unused');
  });
});

describe('The network monitor follows the chains', () => {
  it('As a user, I start the monitor and see the relay of my people chain listed first', async () => {
    // When
    await startHealth();

    // Then
    expect(readStatus().map(chain => [chain.role, chain.genesisHash])).toEqual([
      ['relay', RELAY.genesisHash],
      ['assetHub', ASSET_HUB.genesisHash],
      ['bulletin', BULLETIN.genesisHash],
      ['people', PEOPLE.genesisHash],
    ]);
  });

  it('As a user whose catalog lacks the relay, I start the monitor and see no relay row', async () => {
    // Given
    getCatalog = () => Promise.resolve([ASSET_HUB, BULLETIN, PEOPLE]);

    // When
    await startHealth();

    // Then
    expect(readStatus().map(chain => chain.role)).toEqual(['assetHub', 'bulletin', 'people']);
  });

  it('As a user, I take a chain and see it in use', async () => {
    // Given
    await startHealth();

    // When
    tellActivity(buildActivity(PEOPLE, {}));

    // Then
    expect(findStatus(PEOPLE).state).toBe('live');
  });

  it('As a user, I get a best block on a chain in use and see it recorded', async () => {
    // Given
    await startHealth();
    tellActivity(buildActivity(PEOPLE, {}));

    // When
    tellBestBlock(PEOPLE.genesisHash, 100);

    // Then
    expect(findStatus(PEOPLE).latest).toBe(100);
  });

  it('As a user, I get a light-client report and see its phase and peers', async () => {
    // Given
    await startHealth();

    // When
    tellLifecycle(RELAY.genesisHash, { phase: { kind: 'ready' }, peers: 7, health: { kind: 'ok' } });

    // Then
    expect([findStatus(RELAY).phase, findStatus(RELAY).peers]).toEqual(['ready', 7]);
  });

  it('As a user whose catalog fails to load, I start the monitor and see it fail with nothing watched', async () => {
    // Given
    getCatalog = () => Promise.reject(new Error('no catalog'));

    // When
    const started = startHealth();

    // Then
    await expect(started).rejects.toThrow('no catalog');
    expect({ pool: poolWatchers.size, lifecycles: lifecycleListeners.size }).toEqual({ pool: 0, lifecycles: 0 });
  });

  it('As a user, I stop the monitor and see both watches end and no later recheck change the health', async () => {
    // Given
    const stop = await startHealth();
    useAll();
    blockAll(100);

    // When
    stop();
    await vi.advanceTimersByTimeAsync(getEveryChainOverdueMs());

    // Then
    expect({
      pool: poolWatchers.size,
      lifecycles: lifecycleListeners.size,
      health: networkMonitor.health.get(),
    }).toEqual({ pool: 0, lifecycles: 0, health: 'connected' });
  });
});

describe('The network status', () => {
  it('As a user, I read the network status and see it read now with the verdict over its chains', async () => {
    // Given a relay the light client reports stalled
    await startHealth();
    useAll();
    tellLifecycle(RELAY.genesisHash, {
      phase: { kind: 'ready' },
      peers: 3,
      health: { kind: 'stalled', reason: 'noProgress' },
    });

    // When
    const status = await firstValueFrom(networkMonitorUseCase.networkStatus$({ isReachable: () => true }));

    // Then
    expect({ readAt: status.readAt, chains: status.chains.length, verdict: status.verdict }).toEqual({
      readAt: Date.now(),
      chains: 4,
      verdict: { health: 'unstable', slow: [RELAY.genesisHash] },
    });
  });
});

async function startHealth(): Promise<VoidFunction> {
  const stop = await networkMonitorUseCase.start(ENVIRONMENT, {
    watchPool(watcher) {
      poolWatchers.add(watcher);
      return () => {
        poolWatchers.delete(watcher);
      };
    },
    watchLifecycles(listener) {
      lifecycleListeners.add(listener);
      return () => {
        lifecycleListeners.delete(listener);
      };
    },
    isReachable: () => true,
    getChains: () => getCatalog(),
    online$,
    visible$,
  });
  stops.push(stop);
  return stop;
}

// Returns a wait after a block past which every active chain's next block is overdue.
function getEveryChainOverdueMs(): number {
  const slowest = Math.max(...readBlockTimes());
  return slowest * 3 + 2000;
}

// A consumer holds every active chain, connected and following, unless the test says otherwise.
function useAll(overrides: Partial<Omit<ChainActivity<Chain>, 'chain'>> = {}): void {
  for (const chain of ACTIVE_CHAINS) {
    tellActivity(buildActivity(chain, overrides));
  }
}

function blockAll(blockNumber: number): void {
  for (const chain of ACTIVE_CHAINS) {
    tellBestBlock(chain.genesisHash, blockNumber);
  }
}

function buildActivity(chain: Chain, overrides: Partial<Omit<ChainActivity<Chain>, 'chain'>>): ChainActivity<Chain> {
  return { chain, consumers: 1, status: 'connected', following: true, ...overrides };
}

function tellActivity(activity: ChainActivity<Chain>): void {
  for (const watcher of poolWatchers) {
    watcher.onActivity(activity);
  }
}

function tellBestBlock(genesis: string, blockNumber: number): void {
  for (const watcher of poolWatchers) {
    watcher.onBestBlock(genesis, blockNumber);
  }
}

function tellLifecycle(genesis: GenesisHash, lifecycle: ChainLifecycle | null): void {
  for (const listener of lifecycleListeners) {
    listener(genesis, lifecycle);
  }
}

// The block times the monitor seeded for its known chains.
function readBlockTimes(): number[] {
  return readStatus().map(row => row.blockTimeMs);
}

function readStatus() {
  return networkMonitorService.readNetworkStatus(networkMonitor.model.get(), () => true, Date.now());
}

function findStatus(chain: Chain) {
  const status = readStatus().find(row => row.genesisHash === chain.genesisHash);
  if (status === undefined) {
    throw new Error(`No status row for ${chain.name}`);
  }
  return status;
}

function buildChain(name: string, genesis: string): Chain {
  return {
    chainId: name,
    genesisHash: v.parse(genesisHash, genesis),
    name,
    assets: [],
    nodes: [],
    addressPrefix: 0,
  };
}
