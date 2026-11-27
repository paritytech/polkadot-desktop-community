import { describe, expect, it } from 'vitest';

import { type BlockBar, type ChainClock, type ChainPhase } from '../monitor/types';

import { networkHealthService } from './service';
import { type ChainHealth, type ChainHealthFacts, type LiveVerdict, type NetworkHealth } from './types';

const RELAY = `0x${'01'.repeat(32)}`;
const HUB = `0x${'02'.repeat(32)}`;

describe('The network health verdict', () => {
  it.each<{ story: string; chains: ChainClock[]; online: boolean; expected: NetworkHealth }>([
    { story: 'offline after the chains last reported', chains: [createChain()], online: false, expected: 'offline' },
    { story: 'offline with no chain reported', chains: [], online: false, expected: 'offline' },
    {
      story: 'whose chains in use all produce blocks on time',
      chains: [createChain(), createChain({ genesisHash: HUB })],
      online: true,
      expected: 'connected',
    },
    { story: 'with no chain in use and nothing pending', chains: [], online: true, expected: 'unused' },
    {
      story: 'with only a chain nobody uses',
      chains: [createChain({ state: 'unused', latest: null, sinceLast: null })],
      online: true,
      expected: 'unused',
    },
    {
      story: 'while a chain in use connects',
      chains: [createChain({ state: 'pending', latest: null, sinceLast: null })],
      online: true,
      expected: 'syncing',
    },
    {
      story: 'while the frame syncs one of two chains in use',
      chains: [createChain(), createChain({ genesisHash: HUB, state: 'pending', latest: null })],
      online: true,
      expected: 'syncing',
    },
    {
      story: 'beside a chain nobody uses that is far behind',
      chains: [createChain(), createChain({ genesisHash: HUB, state: 'unused', sinceLast: 60_000 })],
      online: true,
      expected: 'connected',
    },
    {
      story: 'whose chain in use is past three block times without a block',
      chains: [createChain({ sinceLast: 18_001 })],
      online: true,
      expected: 'unstable',
    },
    {
      story: 'on a network with no endpoint for any chain',
      chains: [createChain({ reachable: false, state: 'unused' }), createChain({ genesisHash: HUB, reachable: false })],
      online: true,
      expected: 'unreachable',
    },
    {
      story: 'whose chain stalled or dropped back to connecting',
      chains: [createChain({ alarm: true, latest: null, sinceLast: null })],
      online: true,
      expected: 'unstable',
    },
  ])('As a user $story, I look at the network health and see $expected', ({ chains, online, expected }) => {
    // When
    const health = networkHealthService.judgeNetworkHealth(chains, online);

    // Then
    expect(health).toBe(expected);
  });
});

describe('The network menu verdict', () => {
  it.each<{ story: string; chains: ChainClock[]; expected: LiveVerdict }>([
    {
      story: 'whose chains in use all produce blocks',
      chains: [createChain(), createChain({ genesisHash: HUB })],
      expected: { health: 'connected' },
    },
    {
      story: 'while one of two chains in use connects',
      chains: [createChain(), createChain({ genesisHash: HUB, state: 'pending', latest: null, sinceLast: null })],
      expected: { health: 'syncing' },
    },
    {
      story: 'while the only chain in use connects',
      chains: [createChain({ state: 'pending', latest: null, sinceLast: null })],
      expected: { health: 'syncing' },
    },
    {
      story: 'whose chains are overdue or stalled',
      chains: [createChain({ sinceLast: 18_001 }), createChain({ genesisHash: HUB, alarm: true })],
      expected: { health: 'unstable', slow: [RELAY, HUB] },
    },
    {
      story: 'with nothing in use',
      chains: [createChain({ state: 'unused' })],
      expected: { health: 'unused' },
    },
  ])('As a user $story, I open the network menu and the verdict reads $expected.health', ({ chains, expected }) => {
    // When
    const verdict = networkHealthService.describeLiveNetwork(chains);

    // Then
    expect(verdict).toEqual(expected);
  });
});

describe('isNetworkOffline', () => {
  it.each<{ health: NetworkHealth; offline: boolean }>([
    { health: 'connected', offline: false },
    { health: 'syncing', offline: false },
    { health: 'unstable', offline: false },
    { health: 'offline', offline: true },
    { health: 'unused', offline: false },
    { health: 'unreachable', offline: false },
  ])('As a user whose network is $health, I ask whether I am offline and am told $offline', ({ health, offline }) => {
    // Given the row's network health, from the table

    // When
    const answer = networkHealthService.isNetworkOffline(health);

    // Then
    expect(answer).toBe(offline);
  });
});

describe('getNextOverdueAt', () => {
  it('As a user watching the network health, I wait and only a live chain on time is due a recheck', () => {
    // Given
    const now = 50_000;

    // When
    const due = {
      onTime: networkHealthService.getNextOverdueAt([createChain({ sinceLast: 1000 })], now),
      unusedOrAlarmed: networkHealthService.getNextOverdueAt(
        [createChain({ state: 'unused' }), createChain({ alarm: true })],
        now,
      ),
    };

    // Then
    expect(due).toEqual({ onTime: now - 1000 + 18_000, unusedOrAlarmed: null });
  });
});

// A 6 s chain, read as stalled after 60 s with no block.
const CHAIN = {
  reachable: true,
  state: 'live',
  bars: [],
  blockTimeMs: 6000,
  sinceLast: 0,
  phase: null,
  syncShare: null,
} satisfies Parameters<typeof networkHealthService.describeChainHealth>[0];

const FACTS: ChainHealthFacts = { sinceRead: 0, behind: false, offline: false, unreachable: false };

describe('describeChainHealth', () => {
  it('As a user who is offline, I see a chain with no endpoint as offline', () => {
    // Given
    const chain = { ...CHAIN, reachable: false };

    // When
    const health = networkHealthService.describeChainHealth(chain, { ...FACTS, offline: true, unreachable: true });

    // Then
    expect(health).toEqual({ kind: 'offline' });
  });

  it.each([{ unreachable: true }, { unreachable: false }])(
    'As a user of a chain unused and with no endpoint, when the network is unreachable is $unreachable I see no endpoint',
    ({ unreachable }) => {
      // Given
      const chain = { ...CHAIN, reachable: false, state: 'unused' } satisfies HealthChain;

      // When
      const health = networkHealthService.describeChainHealth(chain, { ...FACTS, unreachable });

      // Then
      expect(health).toEqual({ kind: 'noEndpoint', networkUnreachable: unreachable });
    },
  );

  it('As a user of a chain nobody uses, I see it as not in use', () => {
    // Given
    const chain = { ...CHAIN, state: 'unused', bars: buildBarsWithGaps([6000, 6000]) } satisfies HealthChain;

    // When
    const health = networkHealthService.describeChainHealth(chain, FACTS);

    // Then
    expect(health).toEqual({ kind: 'unused' });
  });

  it('As a user of a chain whose pool dropped, I see it disconnected', () => {
    // Given
    const chain = { ...CHAIN, state: 'down', sinceLast: null } satisfies HealthChain;

    // When
    const health = networkHealthService.describeChainHealth(chain, FACTS);

    // Then
    expect(health).toEqual({ kind: 'disconnected' });
  });

  it.each<{ phase: ChainPhase | null; expected: ChainHealth }>([
    { phase: null, expected: { kind: 'connecting', sinceLast: null } },
    { phase: 'ready', expected: { kind: 'connecting', sinceLast: null } },
    { phase: 'syncing', expected: { kind: 'syncing', syncShare: null, sinceLast: null } },
  ])('As a user of a chain still coming up whose light client reports $phase, I see it $expected.kind', ({ phase, expected }) => {
    // Given
    const chain = { ...CHAIN, state: 'pending', sinceLast: null, phase } satisfies HealthChain;

    // When
    const health = networkHealthService.describeChainHealth(chain, FACTS);

    // Then
    expect(health).toEqual(expected);
  });

  it('As a user of a chain whose light client warps, I see how far it got even with blocks landing', () => {
    // Given
    const chain = {
      ...CHAIN,
      phase: 'syncing',
      syncShare: 0.426,
      bars: buildBarsWithGaps([6000, 6000]),
    } satisfies HealthChain;

    // When
    const health = networkHealthService.describeChainHealth(chain, FACTS);

    // Then
    expect(health).toEqual({ kind: 'syncing', syncShare: 0.426, sinceLast: 0 });
  });

  it('As a user back after a pause, I see a chain with bars from before as connecting until the monitor has it live', () => {
    // Given
    const chain = {
      ...CHAIN,
      state: 'pending',
      sinceLast: null,
      bars: buildBarsWithGaps([6000, 6000]),
    } satisfies HealthChain;

    // When
    const health = networkHealthService.describeChainHealth(chain, FACTS);

    // Then
    expect(health).toEqual({ kind: 'connecting', sinceLast: null });
  });

  it.each<{ phase: ChainPhase; expected: ChainHealth }>([
    { phase: 'connecting', expected: { kind: 'connecting', sinceLast: 0 } },
    { phase: 'syncing', expected: { kind: 'syncing', syncShare: null, sinceLast: 0 } },
  ])('As a user of a live chain whose light client reports $phase again, I see it coming up', ({ phase, expected }) => {
    // Given
    const chain = { ...CHAIN, phase, bars: buildBarsWithGaps([6000, 6000]) } satisfies HealthChain;

    // When
    const health = networkHealthService.describeChainHealth(chain, FACTS);

    // Then
    expect(health).toEqual(expected);
  });

  it('As a user of a live chain with one block and no bar yet, I see it producing with its last block aged by the read', () => {
    // Given
    const chain = { ...CHAIN, sinceLast: 1500, phase: 'ready' } satisfies HealthChain;

    // When
    const health = networkHealthService.describeChainHealth(chain, { ...FACTS, sinceRead: 1000 });

    // Then
    expect(health).toEqual({ kind: 'producing', behind: false, sinceLast: 2500, liveShare: null });
  });

  it.each<{ gaps: number[]; liveShare: number | null }>([
    { gaps: [6000], liveShare: null },
    { gaps: [6000, 6000], liveShare: 1 },
    { gaps: [60_000, 6000, 6000], liveShare: 1 },
  ])(
    'As a user of a chain whose blocks landed $gaps ms apart, I see a live share of $liveShare from its last two intervals',
    ({ gaps, liveShare }) => {
      // Given
      const chain = { ...CHAIN, bars: buildBarsWithGaps(gaps) };

      // When
      const health = networkHealthService.describeChainHealth(chain, FACTS);

      // Then
      expect(health).toEqual({ kind: 'producing', behind: false, sinceLast: 0, liveShare });
    },
  );

  it.each<{ sinceLast: number; sinceRead: number; kind: ChainHealth['kind'] }>([
    { sinceLast: 59_000, sinceRead: 999, kind: 'producing' },
    { sinceLast: 59_000, sinceRead: 1000, kind: 'stalled' },
  ])(
    'As a user of a chain $sinceLast ms after its last block and $sinceRead ms after the read, I see it $kind',
    ({ sinceLast, sinceRead, kind }) => {
      // Given
      const chain = { ...CHAIN, sinceLast, bars: buildBarsWithGaps([6000, 6000]) };

      // When
      const health = networkHealthService.describeChainHealth(chain, { ...FACTS, sinceRead });

      // Then
      expect(health.kind).toBe(kind);
    },
  );

  it.each([{ behind: false }, { behind: true }])(
    'As a user of a chain with no block for 60 s, when the verdict names it is $behind I see it not producing blocks',
    ({ behind }) => {
      // Given
      const chain = { ...CHAIN, sinceLast: 60_000, bars: buildBarsWithGaps([6000, 6000]) };

      // When
      const health = networkHealthService.describeChainHealth(chain, { ...FACTS, behind });

      // Then
      expect(health).toEqual({ kind: 'stalled', behind, sinceLast: 60_000 });
    },
  );

  it.each([4000, 0])(
    'As a user of a chain whose last blocks landed %i ms apart, I see a live share of 1, never above its own block time',
    gapMs => {
      // Given
      const chain = { ...CHAIN, bars: buildBarsWithGaps([gapMs, gapMs]) };

      // When
      const health = networkHealthService.describeChainHealth(chain, FACTS);

      // Then
      expect(health).toEqual({ kind: 'producing', behind: false, sinceLast: 0, liveShare: 1 });
    },
  );

  it.each([
    { blockMs: 7000, liveShare: 6000 / 7000 },
    { blockMs: 12_000, liveShare: 0.5 },
    { blockMs: 15_000, liveShare: 0.4 },
    { blockMs: 30_000, liveShare: 0.2 },
  ])(
    'As a user of a 6 s chain whose last two blocks each took $blockMs ms, I see a live share of $liveShare',
    ({ blockMs, liveShare }) => {
      // Given
      const chain = { ...CHAIN, bars: buildBarsWithGaps([blockMs, blockMs]) };

      // When
      const health = networkHealthService.describeChainHealth(chain, FACTS);

      // Then
      expect(health).toEqual({ kind: 'producing', behind: false, sinceLast: 0, liveShare });
    },
  );

  it.each([{ behind: false }, { behind: true }])(
    'As a user of a chain short of blocks, when the verdict names it is $behind I see it producing at a live share of 0.8',
    ({ behind }) => {
      // Given
      const chain = { ...CHAIN, bars: buildBarsWithGaps([7000, 8000]) };

      // When
      const health = networkHealthService.describeChainHealth(chain, { ...FACTS, behind });

      // Then
      expect(health).toEqual({ kind: 'producing', behind, sinceLast: 0, liveShare: 0.8 });
    },
  );
});

describe('readChainHealthFacts', () => {
  const READ = { readAt: 1000, verdict: { health: 'unstable', slow: [RELAY] } } satisfies Parameters<
    typeof networkHealthService.readChainHealthFacts
  >[1]['network'];

  it('As a user whose network names one chain slow, I see that chain behind and the others not', () => {
    // When
    const facts = [{ genesisHash: RELAY }, { genesisHash: HUB }].map(chain =>
      networkHealthService.readChainHealthFacts(chain, { network: READ, health: 'unstable', now: 1000 }),
    );

    // Then
    expect(facts.map(fact => fact.behind)).toEqual([true, false]);
  });

  it('As a user who went offline, I see a chain read as offline', () => {
    // When
    const facts = networkHealthService.readChainHealthFacts(
      { genesisHash: RELAY },
      { network: READ, health: 'offline', now: 1000 },
    );

    // Then
    expect(facts.offline).toBe(true);
  });

  it('As a user whose whole network is out of reach, I see a chain read as unreachable', () => {
    // When
    const facts = networkHealthService.readChainHealthFacts(
      { genesisHash: RELAY },
      { network: { readAt: 1000, verdict: { health: 'unreachable' } }, health: 'unreachable', now: 1000 },
    );

    // Then
    expect(facts.unreachable).toBe(true);
  });
});

type HealthChain = Parameters<typeof networkHealthService.describeChainHealth>[0];

function createChain(overrides: Partial<ChainClock> = {}): ChainClock {
  return {
    genesisHash: RELAY,
    latest: 100,
    sinceLast: 1000,
    blockTimeMs: 6000,
    reachable: true,
    state: 'live',
    alarm: false,
    ...overrides,
  };
}

// Bars numbered from 100, each landing the given gap after the block before it.
function buildBarsWithGaps(gaps: number[]): BlockBar[] {
  return gaps.map((gapMs, i) => ({ number: 100 + i, health: 'onTime', gapMs }));
}
