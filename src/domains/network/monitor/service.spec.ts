import * as v from 'valibot';
import { beforeEach, describe, expect, it } from 'vitest';

import { type ChainActivity } from '@/shared/chain-connection';
import { hexString } from '@/shared/types';
import { genesisHash } from '../chain/schemas';
import { type Chain } from '../chain/types';

import { networkMonitorService } from './service';
import { type ChainLifecycle, type ChainPhase, type ChainStatus, type KnownChain, type NetworkMonitorModel } from './types';

const RELAY = buildChain('Relay', `0x${'01'.repeat(32)}`);
const ASSET_HUB = buildChain('Asset Hub', `0x${'02'.repeat(32)}`);
const BULLETIN = buildChain('Bulletin', `0x${'03'.repeat(32)}`);
const PEOPLE = buildChain('People', `0x${'04'.repeat(32)}`);
const EXTRA_CHAIN = buildChain('Extra', `0x${'ab'.repeat(32)}`);
const EXTRA = EXTRA_CHAIN.genesisHash;

const KNOWN: KnownChain[] = [
  { role: 'relay', chain: RELAY },
  { role: 'assetHub', chain: ASSET_HUB },
  { role: 'bulletin', chain: BULLETIN },
  { role: 'people', chain: PEOPLE },
];

// Chains the active network offers no endpoint for, by lowercase genesis.
const unreachable = new Set<string>();
let model: NetworkMonitorModel;
let now: number;

beforeEach(() => {
  unreachable.clear();
  now = 0;
  model = networkMonitorService.createModel(KNOWN);
});

describe('Block arrival colouring works', () => {
  it.each<{ gapMs: number; health: string }>([
    { gapMs: 9000, health: 'onTime' },
    { gapMs: 9001, health: 'late' },
    { gapMs: 18_000, health: 'late' },
    { gapMs: 18_001, health: 'veryLate' },
  ])('As a user, I get a block $gapMs ms after the last on a 6000 ms chain and see it read $health', ({ gapMs, health }) => {
    // Given a chain outside the known roles, judged against a 6000 ms block time
    use(EXTRA);
    block(EXTRA, 100);
    now += gapMs;

    // When
    block(EXTRA, 101);

    // Then
    expect(getChain(EXTRA).bars).toEqual([{ number: 101, health, gapMs }]);
  });
});

describe('The network monitor tracks blocks', () => {
  it('As a user, I open the panel and see every known chain of my network listed and unused', () => {
    // When
    const chains = readStatus();

    // Then
    expect(chains.map(chain => [chain.genesisHash, chain.role, chain.name, chain.state])).toEqual([
      [RELAY.genesisHash, 'relay', 'Relay', 'unused'],
      [ASSET_HUB.genesisHash, 'assetHub', 'Asset Hub', 'unused'],
      [BULLETIN.genesisHash, 'bulletin', 'Bulletin', 'unused'],
      [PEOPLE.genesisHash, 'people', 'People', 'unused'],
    ]);
  });

  it('As a user, I get a block on a chain nobody uses and see no block recorded', () => {
    // When
    block(RELAY.genesisHash, 100);

    // Then
    expect(getChain(RELAY.genesisHash).latest).toBeNull();
  });

  it('As a user, I hold a chain the pool names in lowercase and see it land on its known row', () => {
    // When
    use(RELAY.genesisHash.toUpperCase().replace(/^0X/, '0x'));
    use(RELAY.genesisHash.toLowerCase());

    // Then
    expect(readStatus()).toHaveLength(4);
    expect(getChain(RELAY.genesisHash).state).not.toBe('unused');
  });

  it('As a user, I stop using a known chain and see it keep its bars and stop its clock', () => {
    // Given
    use(RELAY.genesisHash);
    block(RELAY.genesisHash, 100);
    now += 6000;
    block(RELAY.genesisHash, 101);

    // When
    release(RELAY.genesisHash);

    // Then
    expect(getChain(RELAY.genesisHash)).toMatchObject({ latest: 101, sinceLast: null, state: 'unused' });
    expect(getChain(RELAY.genesisHash).bars.map(bar => bar.number)).toEqual([101]);
  });

  it('As a user, I hold a chain again and see it carry on from its next block, with no bar for the time it was unused', () => {
    // Given
    use(RELAY.genesisHash);
    block(RELAY.genesisHash, 100);
    now += 6000;
    block(RELAY.genesisHash, 101);
    release(RELAY.genesisHash);
    now += 60_000;

    // When
    use(RELAY.genesisHash);
    block(RELAY.genesisHash, 120);

    // Then
    expect(getChain(RELAY.genesisHash)).toMatchObject({ latest: 120, state: 'live' });
    expect(getChain(RELAY.genesisHash).bars.map(bar => bar.number)).toEqual([101]);
  });

  it('As a user of a product on another chain, I hold that chain and see it listed while in use and gone after', () => {
    // When
    use(EXTRA);
    const listed = getChain(EXTRA);
    release(EXTRA);

    // Then
    expect(listed).toMatchObject({
      role: null,
      name: 'Extra',
      blockTimeMs: 6000,
      reachable: true,
    });
    expect(readStatus().some(chain => chain.genesisHash === EXTRA)).toBe(false);
  });

  it('As a user, I release a chain never held and never see it listed', () => {
    // When
    release(EXTRA);

    // Then
    expect(readStatus()).toHaveLength(4);
  });

  it('As a user watching a chain, I get its first block as the anchor and see bars for later ones', () => {
    // Given
    use(RELAY.genesisHash);
    const relay = getChain(RELAY.genesisHash);

    // When
    block(RELAY.genesisHash, 100);
    const anchored = getChain(RELAY.genesisHash);
    now += relay.blockTimeMs;
    block(RELAY.genesisHash, 101);

    // Then
    expect(anchored.bars.length).toBe(0);
    expect(anchored.latest).toBe(100);
    expect(getChain(RELAY.genesisHash).bars).toEqual([{ number: 101, health: 'onTime', gapMs: relay.blockTimeMs }]);
  });

  it('As a user holding a snapshot of the panel, I get later blocks and see its bars stay as they were', () => {
    // Given
    use(RELAY.genesisHash);
    const relay = getChain(RELAY.genesisHash);
    block(RELAY.genesisHash, 100);
    now += relay.blockTimeMs;
    block(RELAY.genesisHash, 101);
    const held = getChain(RELAY.genesisHash).bars;

    // When
    now += relay.blockTimeMs;
    block(RELAY.genesisHash, 102);

    // Then
    expect(held.map(bar => bar.number)).toEqual([101]);
    expect(Object.isFrozen(held)).toBe(true);
    expect(getChain(RELAY.genesisHash).bars.map(bar => bar.number)).toEqual([101, 102]);
  });

  it('As a user with the panel open all day, I keep getting blocks and see memory stay bounded', () => {
    // Given
    use(RELAY.genesisHash);

    // When
    const counts: number[] = [];
    for (let blockNumber = 1; blockNumber <= 400; blockNumber += 1) {
      now += 6000;
      block(RELAY.genesisHash, blockNumber);
      if (blockNumber % 200 === 0) {
        counts.push(getChain(RELAY.genesisHash).bars.length);
      }
    }

    // Then the strip holds as many bars after 400 blocks as after 200
    expect(counts[1]).toBe(counts[0]);
  });

  it('As a user on a chain that republishes its head, I get one block three times and see one bar', () => {
    // Given
    use(RELAY.genesisHash);

    // When
    now += 6000;
    block(RELAY.genesisHash, 100);
    now += 6000;
    block(RELAY.genesisHash, 101);
    block(RELAY.genesisHash, 101);
    block(RELAY.genesisHash, 101);
    now += 6000;
    block(RELAY.genesisHash, 102);

    // Then
    expect(getChain(RELAY.genesisHash).bars.map(bar => bar.number)).toEqual([101, 102]);
  });

  it('As a user whose chain reorgs to an earlier block, I watch the strip and see it not go backwards', () => {
    // Given
    use(RELAY.genesisHash);

    // When
    now += 6000;
    block(RELAY.genesisHash, 200);
    now += 6000;
    block(RELAY.genesisHash, 201);
    now += 6000;
    block(RELAY.genesisHash, 199);

    // Then
    expect(getChain(RELAY.genesisHash).bars.map(bar => bar.number)).toEqual([201]);
  });

  it('As a user on a network missing an endpoint, I hold that chain and see it unreachable and never in use', () => {
    // Given
    unreachable.add(RELAY.genesisHash.toLowerCase());

    // When
    use(RELAY.genesisHash);

    // Then
    expect(getChain(RELAY.genesisHash)).toMatchObject({ reachable: false, state: 'unused' });
  });

  it('As a user with the panel open, I get a block and see it the moment it lands', () => {
    // Given
    use(RELAY.genesisHash);
    const before = model;

    // When
    block(RELAY.genesisHash, 7);

    // Then
    expect(model).not.toBe(before);
  });

  it('As a user, I read the chain clocks and see each chain timed from its last block', () => {
    // Given
    use(RELAY.genesisHash);
    block(RELAY.genesisHash, 100);
    now += 4000;

    // When
    const clocks = networkMonitorService.readChainClocks(model, isReachable, now);

    // Then
    expect(clocks[0]).toEqual({
      genesisHash: RELAY.genesisHash,
      latest: 100,
      sinceLast: 4000,
      blockTimeMs: 6000,
      reachable: true,
      state: 'live',
      alarm: false,
    });
    expect(clocks.map(clock => clock.genesisHash)).toEqual(KNOWN.map(known => known.chain.genesisHash));
  });
});

describe('The network monitor tracks peers', () => {
  it('As a user watching the panel, I get peer samples and see each chain report the peers it actually holds', () => {
    // When
    phase(RELAY.genesisHash, 'ready', { peers: 7 });
    phase(ASSET_HUB.genesisHash, 'ready', { peers: 3 });
    const byRole = new Map(readStatus().map(chain => [chain.role, chain.peers]));

    // Then
    expect({ relay: byRole.get('relay'), assetHub: byRole.get('assetHub'), people: byRole.get('people') }).toEqual({
      relay: 7,
      assetHub: 3,
      people: null,
    });
  });
});

describe('The network monitor repaints the panel only on a change', () => {
  it.each<{ reports: string; send: VoidFunction; sendChanged: VoidFunction }>([
    {
      reports: 'peer counts',
      send() {
        phase(RELAY.genesisHash, 'ready', { peers: 4 });
      },
      sendChanged() {
        phase(RELAY.genesisHash, 'ready', { peers: 5 });
      },
    },
    {
      reports: 'chain phases',
      send() {
        phase(ASSET_HUB.genesisHash, 'connecting');
      },
      sendChanged() {
        phase(ASSET_HUB.genesisHash, 'ready');
      },
    },
    {
      reports: 'warp shares',
      send() {
        phase(RELAY.genesisHash, 'syncing', { phase: { kind: 'syncing', at: 20, target: 100 } });
      },
      sendChanged() {
        phase(RELAY.genesisHash, 'syncing', { phase: { kind: 'syncing', at: 40, target: 100 } });
      },
    },
  ])(
    'As a user, I get $reports and see the panel repaint when one changes and stay quiet when it repeats',
    ({ send, sendChanged }) => {
      // Given
      send();
      const first = model;

      // When
      send();
      const repeated = model;
      sendChanged();

      // Then
      expect(repeated).toBe(first);
      expect(model).not.toBe(first);
    },
  );
});

describe('The network monitor judges how each chain is used', () => {
  it('As a user whose app dropped its block follow but kept the chain, I wait and see its clock stopped and not overdue, then live again on a new follow', () => {
    // Given
    use(RELAY.genesisHash);
    block(RELAY.genesisHash, 100);
    now += 6000;
    block(RELAY.genesisHash, 101);

    // When
    use(RELAY.genesisHash, { following: false });
    now += 120_000;
    const unfollowed = getChain(RELAY.genesisHash);
    use(RELAY.genesisHash);
    block(RELAY.genesisHash, 140);

    // Then
    expect(unfollowed).toMatchObject({ state: 'live', alarm: false, sinceLast: null, latest: 101 });
    expect(unfollowed.bars.map(bar => bar.number)).toEqual([101]);
    expect(getChain(RELAY.genesisHash)).toMatchObject({ state: 'live', latest: 140 });
    expect(getChain(RELAY.genesisHash).bars.map(bar => bar.number)).toEqual([101]);
  });

  it('As a user, I hold a chain whose pool is connecting and see it pending until the pool reports it connected, then live', () => {
    // When
    use(RELAY.genesisHash, { status: 'connecting' });
    const connecting = getChain(RELAY.genesisHash);
    use(RELAY.genesisHash, { status: 'connected' });

    // Then
    expect(connecting.state).toBe('pending');
    expect(getChain(RELAY.genesisHash).state).toBe('live');
  });

  it('As a user, I hold a chain its pool reports connected and see it live before its first block', () => {
    // When
    use(RELAY.genesisHash);

    // Then
    expect(getChain(RELAY.genesisHash)).toMatchObject({ state: 'live', latest: null });
  });

  it('As a user, I see a chain in use whose pool reports it disconnected read as down', () => {
    // Given
    use(RELAY.genesisHash);

    // When
    use(RELAY.genesisHash, { status: 'disconnected' });

    // Then
    expect(getChain(RELAY.genesisHash).state).toBe('down');
  });

  it.each<ChainPhase>(['connecting', 'syncing'])(
    'As a user, I see a connected chain in use whose light client reports %s read as pending',
    reported => {
      // Given
      use(RELAY.genesisHash);

      // When
      phase(RELAY.genesisHash, reported);

      // Then
      expect(getChain(RELAY.genesisHash).state).toBe('pending');
    },
  );

  it('As a user loading a product, I watch the frame sync a chain nothing holds and see it unused until something takes it', () => {
    // When
    phase(RELAY.genesisHash, 'syncing');
    const syncing = getChain(RELAY.genesisHash);
    use(RELAY.genesisHash);

    // Then
    expect(syncing).toMatchObject({ state: 'unused', alarm: false });
    expect(getChain(RELAY.genesisHash)).toMatchObject({ state: 'pending', alarm: false });
  });

  it('As a user, I see the share of its warp a chain proved', () => {
    // When
    phase(RELAY.genesisHash, 'syncing', { phase: { kind: 'syncing', at: 40, target: 100 } });

    // Then
    expect(getChain(RELAY.genesisHash)).toMatchObject({ syncShare: 0.4 });
  });

  it.each<{ reported: ChainPhase; alarm: boolean }>([
    { reported: 'connecting', alarm: false },
    { reported: 'syncing', alarm: false },
    { reported: 'ready', alarm: false },
    { reported: 'stalled', alarm: true },
  ])(
    'As a user, I see the light client report a chain in use $reported and the alarm raised is $alarm',
    ({ reported, alarm }) => {
      // Given
      use(RELAY.genesisHash);
      block(RELAY.genesisHash, 100);

      // When
      phase(RELAY.genesisHash, reported);

      // Then
      expect(getChain(RELAY.genesisHash).alarm).toBe(alarm);
    },
  );

  it.each<{ drop: string; leave: VoidFunction; back: VoidFunction }>([
    {
      drop: 'its pool disconnects',
      leave() {
        use(RELAY.genesisHash, { status: 'disconnected' });
      },
      back() {
        use(RELAY.genesisHash, { status: 'connected' });
      },
    },
    {
      drop: 'its light client syncs again',
      leave() {
        phase(RELAY.genesisHash, 'syncing');
      },
      back() {
        phase(RELAY.genesisHash, 'ready');
      },
    },
  ])(
    'As a user whose chain drops when $drop, I get its first block after it is back and see no bar for the gap',
    ({ leave, back }) => {
      // Given
      use(RELAY.genesisHash);
      phase(RELAY.genesisHash, 'ready');
      block(RELAY.genesisHash, 100);
      now += 6000;
      block(RELAY.genesisHash, 101);

      // When
      leave();
      now += 60_000;
      back();
      block(RELAY.genesisHash, 111);

      // Then
      expect(getChain(RELAY.genesisHash).bars.map(bar => bar.number)).toEqual([101]);
    },
  );

  it('As a user whose chain gets a block while its light client syncs, I see the block recorded with its clock stopped, and bars only from the first block after it is ready', () => {
    // Given a connected chain in use whose light client syncs
    use(RELAY.genesisHash);
    phase(RELAY.genesisHash, 'syncing');

    // When
    block(RELAY.genesisHash, 100);
    now += 60_000;
    const syncing = getChain(RELAY.genesisHash);
    phase(RELAY.genesisHash, 'ready');
    block(RELAY.genesisHash, 101);
    now += 6000;
    block(RELAY.genesisHash, 102);

    // Then
    expect(syncing).toMatchObject({ latest: 100, sinceLast: null });
    expect(getChain(RELAY.genesisHash).bars).toEqual([{ number: 102, health: 'onTime', gapMs: 6000 }]);
  });

  it('As a user whose chain left the light client, I see its phase, share and peers cleared and no stall alarm', () => {
    // Given a chain in use the light client calls stalled after part of a warp
    use(RELAY.genesisHash);
    phase(RELAY.genesisHash, 'syncing', { phase: { kind: 'syncing', at: 50, target: 100 }, peers: 3 });
    phase(RELAY.genesisHash, 'stalled');

    // When
    model = networkMonitorService.recordLightClientLifecycle(model, RELAY.genesisHash, null);

    // Then
    expect(getChain(RELAY.genesisHash)).toMatchObject({ phase: null, syncShare: null, peers: null, alarm: false });
  });

  it('As a user, I see a syncing light client report its warp share and peers', () => {
    // When
    model = networkMonitorService.recordLightClientLifecycle(model, RELAY.genesisHash, {
      phase: { kind: 'syncing', at: 50, target: 100 },
      peers: 3,
      health: { kind: 'ok' },
    });

    // Then
    expect(getChain(RELAY.genesisHash)).toMatchObject({ phase: 'syncing', syncShare: 0.5, peers: 3 });
  });

  it('As a user, I see a ready chain in use the light client calls stalled read as stalled and raise the alarm', () => {
    // Given
    use(RELAY.genesisHash);

    // When
    model = networkMonitorService.recordLightClientLifecycle(model, RELAY.genesisHash, {
      phase: { kind: 'ready' },
      peers: 0,
      health: { kind: 'stalled', reason: 'noPeers' },
    });

    // Then
    expect(getChain(RELAY.genesisHash)).toMatchObject({ phase: 'stalled', alarm: true });
  });
});

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

function isReachable(chain: Chain): boolean {
  return !unreachable.has(chain.genesisHash.toLowerCase());
}

// The schema lowercases a genesis hash, so a pool naming a chain in another case is built by branding the raw value.
function findFixture(genesis: string): Chain {
  const fixture = [...KNOWN.map(known => known.chain), EXTRA_CHAIN].find(chain => chain.genesisHash === genesis.toLowerCase());
  if (fixture === undefined) {
    throw new Error(`No fixture chain for ${genesis}`);
  }
  return { ...fixture, genesisHash: v.parse(v.pipe(hexString, v.brand('GenesisHash')), genesis) };
}

// A consumer holds the chain, connected and following, unless the test says otherwise.
function use(genesis: string, overrides: Partial<Omit<ChainActivity<Chain>, 'chain'>> = {}): void {
  model = networkMonitorService.recordChainActivity(model, {
    chain: findFixture(genesis),
    consumers: 1,
    status: 'connected',
    following: true,
    ...overrides,
  });
}

function release(genesis: string): void {
  model = networkMonitorService.recordChainActivity(model, {
    chain: findFixture(genesis),
    consumers: 0,
    status: 'connected',
    following: false,
  });
}

function block(genesis: string, blockNumber: number): void {
  model = networkMonitorService.recordBestBlock(model, genesis, blockNumber, now);
}

// `stalled` is a ready chain whose light client stopped making progress.
function phase(genesis: string, reported: ChainPhase, overrides: Partial<ChainLifecycle> = {}): void {
  const lifecycle: ChainLifecycle = {
    phase: buildLifecyclePhase(reported),
    peers: 0,
    health: reported === 'stalled' ? { kind: 'stalled', reason: 'noProgress' } : { kind: 'ok' },
    ...overrides,
  };
  model = networkMonitorService.recordLightClientLifecycle(model, genesis, lifecycle);
}

function buildLifecyclePhase(reported: ChainPhase): ChainLifecycle['phase'] {
  switch (reported) {
    case 'connecting':
      return { kind: 'connecting' };
    case 'syncing':
      return { kind: 'syncing', at: 0, target: 0 };
    case 'ready':
    case 'stalled':
      return { kind: 'ready' };
  }
}

function readStatus(): ChainStatus[] {
  return networkMonitorService.readNetworkStatus(model, isReachable, now);
}

function getChain(genesis: string): ChainStatus {
  const status = readStatus().find(chain => chain.genesisHash === genesis.toLowerCase());
  if (status === undefined) {
    throw new Error(`No chain listed for ${genesis}`);
  }
  return status;
}
