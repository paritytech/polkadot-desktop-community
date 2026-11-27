import { describe, expect, it } from 'vitest';

import { type BlockBar, type ChainHealth } from '@/domains/network';

import { HISTORY_SLOTS, RING_LENGTH } from './constants';
import { networkStatusService } from './service';
import { type ArcDash, type ChainMark, type ChainStatusLine, type PendingBar } from './types';

// A 6 s chain.
const BLOCK_TIME_MS = 6000;

describe('slotOpacity', () => {
  it('As a user reading the history, the oldest slot is half strength and the newest full', () => {
    // When / Then
    expect(networkStatusService.slotOpacity(0)).toBe('0.50');
    expect(networkStatusService.slotOpacity(HISTORY_SLOTS - 1)).toBe('1.00');
  });
});

describe('describeBlockDelay', () => {
  it.each([
    { gapMs: 6000, said: { gap: '6.0', late: null } },
    { gapMs: 12_000, said: { gap: '12', late: '6.0' } },
  ])('As a user hovering a block that came after $gapMs ms of a 6s block time, it reads $said', ({ gapMs, said }) => {
    // When
    const delay = networkStatusService.describeBlockDelay(gapMs, BLOCK_TIME_MS);

    // Then
    expect(delay).toEqual(said);
  });
});

describe('the bar strip motion', () => {
  const bars = (...numbers: number[]): { number: number }[] => numbers.map(number => ({ number }));

  it('As a user watching a chain, the blocks newer than the newest shown are the ones that land', () => {
    // When / Then
    expect(networkStatusService.landedBars(bars(101, 102), bars(101, 102, 103))).toBe(1);
    expect(networkStatusService.landedBars(bars(101, 102), bars(102, 103, 104))).toBe(2);
  });

  it('As a user watching a chain, a re-render with the same history lands nothing', () => {
    // When / Then
    expect(networkStatusService.landedBars(bars(101, 102), bars(101, 102))).toBe(0);
  });

  it('As a user opening the panel on a chain with history, bars in a strip that showed none appear without sliding', () => {
    // When / Then
    expect(networkStatusService.landedBars([], bars(101, 102))).toBe(0);
  });
});

describe('the ghost bar before a chain first bar', () => {
  const chain = { bars: [], blockTimeMs: BLOCK_TIME_MS };

  it('As a user of a chain with no block yet, the ghost bar searches', () => {
    // When
    const bar = networkStatusService.pickPendingBar(chain, { kind: 'connecting', sinceLast: null });

    // Then
    expect(bar).toEqual({ phase: 'searching' });
  });

  it('As a user waiting for the next block of a chain, the ghost bar grows toward it', () => {
    // When
    const bar = networkStatusService.pickPendingBar(chain, {
      kind: 'producing',
      behind: false,
      sinceLast: 1500,
      liveShare: null,
    });

    // Then
    expect(bar).toEqual({ phase: 'counting', heightPercent: 59 });
  });

  it('As a user of a chain at or past its block time, the ghost bar stands full and due', () => {
    // When
    const bars = [6000, 19_000].map(sinceLast => networkStatusService.pickPendingBar(chain, { kind: 'connecting', sinceLast }));

    // Then
    expect(bars).toEqual([
      { phase: 'due', heightPercent: 100 },
      { phase: 'due', heightPercent: 100 },
    ]);
  });
});

describe('sameBars', () => {
  it('As a user watching a chain, an update that kept the same bar objects lands nothing', () => {
    // Given
    const first = { number: 1 };
    const second = { number: 2 };

    // When / Then
    expect(networkStatusService.sameBars([first, second], [first, second])).toBe(true);
    expect(networkStatusService.sameBars([first, second], [first, { number: 2 }])).toBe(false);
    expect(networkStatusService.sameBars([first], [first, second])).toBe(false);
  });
});

describe('A chain row from its health', () => {
  it.each<{
    story: string;
    health: ChainHealth;
    bars?: BlockBar[];
    blockTimeMs?: number;
    mark: ChainMark;
    status: ChainStatusLine;
    pending: PendingBar | null;
  }>([
    {
      story: 'who is offline',
      health: { kind: 'offline' },
      mark: { kind: 'unavailable' },
      status: { text: { kind: 'noInternet' }, tone: null },
      pending: null,
    },
    {
      story: 'of a chain with no endpoint on an unreachable network',
      health: { kind: 'noEndpoint', networkUnreachable: true },
      mark: { kind: 'unavailable' },
      status: { text: { kind: 'noEndpoint' }, tone: 'err' },
      pending: null,
    },
    {
      story: 'of a chain with no endpoint on a reachable network',
      health: { kind: 'noEndpoint', networkUnreachable: false },
      mark: { kind: 'unavailable' },
      status: { text: { kind: 'noEndpoint' }, tone: 'warn' },
      pending: null,
    },
    {
      story: 'of a chain nobody uses',
      health: { kind: 'unused' },
      bars: buildBarsWithGaps([6000, 6000]),
      mark: { kind: 'unused' },
      status: { text: { kind: 'notInUse' }, tone: null },
      pending: null,
    },
    {
      story: 'of a chain whose pool dropped, with no ghost bar to wait on',
      health: { kind: 'disconnected' },
      mark: { kind: 'unavailable' },
      status: { text: { kind: 'disconnected' }, tone: null },
      pending: null,
    },
    {
      story: 'of a chain still coming up',
      health: { kind: 'connecting', sinceLast: null },
      mark: { kind: 'connecting' },
      status: { text: { kind: 'connecting' }, tone: null },
      pending: { phase: 'searching' },
    },
    {
      story: 'of a chain whose light client starts a warp',
      health: { kind: 'syncing', syncShare: null, sinceLast: null },
      mark: { kind: 'connecting' },
      status: { text: { kind: 'syncing', percent: null }, tone: null },
      pending: { phase: 'searching' },
    },
    {
      story: 'of a chain whose light client warps with blocks landing',
      health: { kind: 'syncing', syncShare: 0.426, sinceLast: 0 },
      bars: buildBarsWithGaps([6000, 6000]),
      mark: { kind: 'connecting' },
      status: { text: { kind: 'syncing', percent: 43 }, tone: null },
      pending: null,
    },
    {
      story: 'of a chain whose light client warped 42% with no block yet',
      health: { kind: 'syncing', syncShare: 0.42, sinceLast: null },
      mark: { kind: 'connecting' },
      status: { text: { kind: 'syncing', percent: 42 }, tone: null },
      pending: { phase: 'searching' },
    },
    {
      story: 'back after a pause, with bars from before',
      health: { kind: 'connecting', sinceLast: null },
      bars: buildBarsWithGaps([6000, 6000]),
      mark: { kind: 'connecting' },
      status: { text: { kind: 'connecting' }, tone: null },
      pending: null,
    },
    {
      story: 'of a live chain with one block and no bar yet',
      health: { kind: 'producing', behind: false, sinceLast: 2500, liveShare: null },
      mark: { kind: 'healthy' },
      status: { text: { kind: 'producing', behind: false, live: null }, tone: null },
      pending: { phase: 'counting', heightPercent: 68 },
    },
    {
      story: 'of a chain whose blocks landed on time',
      health: { kind: 'producing', behind: false, sinceLast: 0, liveShare: 1 },
      bars: buildBarsWithGaps([6000, 6000]),
      mark: { kind: 'healthy' },
      status: {
        text: { kind: 'producing', behind: false, live: { percent: 100, block: { minutes: 0, seconds: 6 } } },
        tone: null,
      },
      pending: null,
    },
    {
      story: 'of a chain with a measured share above the healthy one',
      health: { kind: 'producing', behind: false, sinceLast: 0, liveShare: 6000 / 6900 },
      bars: buildBarsWithGaps([6900, 6900]),
      mark: { kind: 'healthy' },
      status: {
        text: { kind: 'producing', behind: false, live: { percent: 87, block: { minutes: 0, seconds: 7 } } },
        tone: null,
      },
      pending: null,
    },
    {
      story: 'of a chain with no block for 60 s',
      health: { kind: 'stalled', behind: false, sinceLast: 60_000 },
      bars: buildBarsWithGaps([6000, 6000]),
      mark: { kind: 'outage' },
      status: { text: { kind: 'notProducing' }, tone: null },
      pending: null,
    },
    {
      story: 'of a chain with no block for 60 s that the verdict names',
      health: { kind: 'stalled', behind: true, sinceLast: 60_000 },
      bars: buildBarsWithGaps([6000, 6000]),
      mark: { kind: 'outage' },
      status: { text: { kind: 'notProducing' }, tone: 'warn' },
      pending: null,
    },
    {
      story: 'of a chain short of blocks',
      health: { kind: 'producing', behind: false, sinceLast: 0, liveShare: 0.8 },
      bars: buildBarsWithGaps([7000, 8000]),
      mark: { kind: 'short', share: 0.8, band: 'plain' },
      status: {
        text: { kind: 'producing', behind: false, live: { percent: 80, block: { minutes: 0, seconds: 8 } } },
        tone: null,
      },
      pending: null,
    },
    {
      story: 'of a chain short of blocks that the verdict names',
      health: { kind: 'producing', behind: true, sinceLast: 0, liveShare: 0.8 },
      bars: buildBarsWithGaps([7000, 8000]),
      mark: { kind: 'short', share: 0.8, band: 'plain' },
      status: {
        text: { kind: 'producing', behind: true, live: { percent: 80, block: { minutes: 0, seconds: 8 } } },
        tone: 'warn',
      },
      pending: null,
    },
    {
      story: 'of a slow chain far short of blocks',
      health: { kind: 'producing', behind: false, sinceLast: 0, liveShare: 6500 / 65_000 },
      bars: buildBarsWithGaps([65_000, 65_000]),
      blockTimeMs: 6500,
      mark: { kind: 'short', share: 6500 / 65_000, band: 'err' },
      status: {
        text: { kind: 'producing', behind: false, live: { percent: 10, block: { minutes: 1, seconds: 5 } } },
        tone: null,
      },
      pending: null,
    },
    {
      story: 'of a chain whose blocks take minutes',
      health: { kind: 'producing', behind: false, sinceLast: 0, liveShare: 6000 / 125_000 },
      bars: buildBarsWithGaps([125_000, 125_000]),
      mark: { kind: 'short', share: 6000 / 125_000, band: 'err' },
      status: {
        text: { kind: 'producing', behind: false, live: { percent: 5, block: { minutes: 2, seconds: 5 } } },
        tone: null,
      },
      pending: null,
    },
  ])(
    'As a user $story, I see its mark, status line and ghost bar',
    ({ health, bars = [], blockTimeMs = BLOCK_TIME_MS, mark, status, pending }) => {
      // Given
      const chain = { bars, blockTimeMs };

      // When
      const row = {
        mark: networkStatusService.pickChainMark(health),
        status: networkStatusService.describeChainStatus(health, blockTimeMs),
        pending: networkStatusService.pickPendingBar(chain, health),
      };

      // Then
      expect(row).toEqual({ mark, status, pending });
    },
  );

  it.each<{ sinceLast: number; kind: ChainMark['kind']; health: ChainHealth }>([
    {
      sinceLast: 59_999,
      kind: 'healthy',
      health: { kind: 'producing', behind: false, sinceLast: 59_999, liveShare: 1 },
    },
    { sinceLast: 60_000, kind: 'outage', health: { kind: 'stalled', behind: false, sinceLast: 60_000 } },
  ])('As a user of a chain $sinceLast ms after its last block, I see the $kind mark', ({ health, kind }) => {
    // When
    const mark = networkStatusService.pickChainMark(health);

    // Then
    expect(mark.kind).toBe(kind);
  });

  it.each<{ liveShare: number; mark: ChainMark }>([
    { liveShare: 6000 / 7000, mark: { kind: 'healthy' } },
    { liveShare: 0.6, mark: { kind: 'short', share: 0.6, band: 'plain' } },
    { liveShare: 0.5, mark: { kind: 'short', share: 0.5, band: 'plain' } },
    { liveShare: 0.4, mark: { kind: 'short', share: 0.4, band: 'warn' } },
    { liveShare: 0.2, mark: { kind: 'short', share: 0.2, band: 'err' } },
  ])('As a user of a chain at a live share of $liveShare, I see the $mark.kind mark', ({ liveShare, mark }) => {
    // When
    const shown = networkStatusService.pickChainMark({ kind: 'producing', behind: false, sinceLast: 0, liveShare });

    // Then
    expect(shown).toEqual(mark);
  });

  it('As an offline user of a chain waiting for its first block, I see no ghost bar to wait on', () => {
    // When
    const pending = networkStatusService.pickPendingBar({ bars: [], blockTimeMs: BLOCK_TIME_MS }, { kind: 'offline' });

    // Then
    expect(pending).toBeNull();
  });
});

describe('traceArc', () => {
  it.each<{ mark: ChainMark; arc: ArcDash }>([
    { mark: { kind: 'healthy' }, arc: { dash: RING_LENGTH, gap: RING_LENGTH, offset: 0 } },
    { mark: { kind: 'short', share: 0.4, band: 'warn' }, arc: { dash: 0.4 * RING_LENGTH, gap: RING_LENGTH, offset: 0 } },
    { mark: { kind: 'outage' }, arc: { dash: 0.75 * RING_LENGTH, gap: RING_LENGTH, offset: -0.25 * RING_LENGTH } },
    { mark: { kind: 'connecting' }, arc: { dash: RING_LENGTH, gap: RING_LENGTH, offset: 0 } },
    { mark: { kind: 'unavailable' }, arc: { dash: 0, gap: RING_LENGTH / 24, offset: 0 } },
    { mark: { kind: 'unused' }, arc: { dash: RING_LENGTH, gap: RING_LENGTH, offset: 0 } },
  ])('As a user looking at a $mark.kind mark, I see its arc traced', ({ mark, arc }) => {
    // When
    const traced = networkStatusService.traceArc(mark);

    // Then
    expect(traced).toEqual(arc);
  });
});

describe('showBars', () => {
  it('As a user of an unreachable chain, I see none of its old bars', () => {
    // Given
    const chain = { reachable: false, bars: buildBarsWithGaps([6000, 6000]) };

    // When
    const shown = networkStatusService.showBars(chain);

    // Then
    expect(shown).toEqual([]);
  });

  it('As a user of a chain with more bars than slots, I see the newest that fit, as the same objects', () => {
    // Given
    const bars = buildBarsWithGaps(Array.from({ length: 50 }, () => 6000));

    // When
    const shown = networkStatusService.showBars({ reachable: true, bars });

    // Then
    expect(shown).toHaveLength(HISTORY_SLOTS);
    expect(shown[0]).toBe(bars[2]);
    expect(shown.at(-1)).toBe(bars[49]);
  });
});

describe('isWatched', () => {
  it.each([
    { story: 'a reachable chain in use', chain: { reachable: true, state: 'live' }, watched: true },
    { story: 'a chain nobody uses', chain: { reachable: true, state: 'unused' }, watched: false },
    { story: 'an unreachable chain', chain: { reachable: false, state: 'live' }, watched: false },
  ] as const)('As a user of $story, I am told it is watched: $watched', ({ chain, watched }) => {
    // When
    const answer = networkStatusService.isWatched(chain);

    // Then
    expect(answer).toBe(watched);
  });
});

describe('splitDuration', () => {
  it.each([
    { ms: 6400, duration: { minutes: 0, seconds: 6 } },
    { ms: 59_499, duration: { minutes: 0, seconds: 59 } },
    { ms: 59_500, duration: { minutes: 1, seconds: 0 } },
    { ms: 125_000, duration: { minutes: 2, seconds: 5 } },
  ])('As a user reading a block time of $ms ms, I see $duration.minutes m $duration.seconds s', ({ ms, duration }) => {
    // When
    const split = networkStatusService.splitDuration(ms);

    // Then
    expect(split).toEqual(duration);
  });
});

// Bars numbered from 100, each landing the given gap after the block before it.
function buildBarsWithGaps(gaps: number[]): BlockBar[] {
  return gaps.map((gapMs, i) => ({ number: 100 + i, health: 'onTime', gapMs }));
}
