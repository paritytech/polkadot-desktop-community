import { type BlockBar, type ChainHealth, type ChainStatus } from '@/domains/network';

import { HEALTHY_SHARE, HISTORY_SLOTS, RING_LENGTH } from './constants';
import {
  type ArcBand,
  type ArcDash,
  type BlockDelay,
  type ChainMark,
  type ChainStatusLine,
  type Duration,
  type PendingBar,
} from './types';

function pickChainMark(health: ChainHealth): ChainMark {
  switch (health.kind) {
    case 'offline':
    case 'noEndpoint':
    case 'disconnected':
      return { kind: 'unavailable' };
    case 'unused':
      return { kind: 'unused' };
    case 'syncing':
    case 'connecting':
      return { kind: 'connecting' };
    case 'stalled':
      return { kind: 'outage' };
    case 'producing': {
      const share = health.liveShare;
      return share === null || share >= HEALTHY_SHARE ? { kind: 'healthy' } : { kind: 'short', share, band: pickArcBand(share) };
    }
  }
}

// Blocks a catching-up client hears back to back are not faster production, so the block time divides by the share
// capped at 1 and never reads under the chain's own.
function describeChainStatus(health: ChainHealth, blockTimeMs: number): ChainStatusLine {
  switch (health.kind) {
    case 'offline':
      return { text: { kind: 'noInternet' }, tone: null };
    case 'noEndpoint':
      return { text: { kind: 'noEndpoint' }, tone: health.networkUnreachable ? 'err' : 'warn' };
    case 'unused':
      return { text: { kind: 'notInUse' }, tone: null };
    case 'disconnected':
      return { text: { kind: 'disconnected' }, tone: null };
    case 'syncing':
      return {
        text: { kind: 'syncing', percent: health.syncShare === null ? null : Math.round(health.syncShare * 100) },
        tone: null,
      };
    case 'connecting':
      return { text: { kind: 'connecting' }, tone: null };
    case 'stalled':
      return { text: { kind: 'notProducing' }, tone: health.behind ? 'warn' : null };
    case 'producing': {
      const share = health.liveShare;
      const live = share === null ? null : { percent: Math.round(share * 100), block: splitDuration(blockTimeMs / share) };
      return { text: { kind: 'producing', behind: health.behind, live }, tone: health.behind ? 'warn' : null };
    }
  }
}

// The ghost bar waits for a chain's first bar while the chain is coming up or producing.
function pickPendingBar(chain: Pick<ChainStatus, 'bars' | 'blockTimeMs'>, health: ChainHealth): PendingBar | null {
  if (chain.bars.length > 0) {
    return null;
  }
  switch (health.kind) {
    case 'syncing':
    case 'connecting':
    case 'stalled':
    case 'producing':
      return measurePendingBar(chain.blockTimeMs, health.sinceLast);
    case 'offline':
    case 'noEndpoint':
    case 'unused':
    case 'disconnected':
      return null;
  }
}

// The bar starts at a height that still reads as a bar.
function measurePendingBar(blockTimeMs: number, sinceLast: number | null): PendingBar {
  if (sinceLast === null) {
    return { phase: 'searching' };
  }
  const heightPercent = Math.round(45 + Math.min(sinceLast / blockTimeMs, 1) * 55);
  return { phase: sinceLast < blockTimeMs ? 'counting' : 'due', heightPercent };
}

// Whether a chain has an endpoint and is in use, so its reads age between blocks.
function isWatched(chain: Pick<ChainStatus, 'reachable' | 'state'>): boolean {
  return chain.reachable && chain.state !== 'unused';
}

// An unreachable chain's old bars say nothing about the network it is on now.
function showBars(chain: Pick<ChainStatus, 'reachable' | 'bars'>): readonly BlockBar[] {
  return chain.reachable ? chain.bars.slice(-HISTORY_SLOTS) : [];
}

// Bars landing in a strip that showed none appear without sliding, so they count as none.
function landedBars(before: readonly { number: number }[], shown: readonly { number: number }[]): number {
  const newest = before.at(-1)?.number;
  const landed = newest === undefined ? shown.length : shown.filter(bar => bar.number > newest).length;
  return landed > 0 && shown.length > landed ? landed : 0;
}

// A bar already drawn keeps its object across updates, so the same objects mean no block landed.
function sameBars(a: readonly unknown[], b: readonly unknown[]): boolean {
  return a.length === b.length && a.every((bar, i) => bar === b[i]);
}

function slotOpacity(slot: number): string {
  return (0.5 + (0.5 * slot) / (HISTORY_SLOTS - 1)).toFixed(2);
}

// A block inside the expectation has no lateness, since "0s late" suggests a problem.
function describeBlockDelay(gapMs: number, blockTimeMs: number): BlockDelay {
  const late = gapMs - blockTimeMs;
  return { gap: formatSeconds(gapMs), late: late <= 0 ? null : formatSeconds(late) };
}

function splitDuration(ms: number): Duration {
  const seconds = Math.round(ms / 1000);
  return seconds < 60 ? { minutes: 0, seconds } : { minutes: Math.floor(seconds / 60), seconds: seconds % 60 };
}

function traceArc(mark: ChainMark): ArcDash {
  switch (mark.kind) {
    case 'short':
      return { dash: mark.share * RING_LENGTH, gap: RING_LENGTH, offset: 0 };
    // Three quarters clockwise from the top, so the gap is the upper-left quarter.
    case 'outage':
      return { dash: 0.75 * RING_LENGTH, gap: RING_LENGTH, offset: -0.25 * RING_LENGTH };
    // A dash of zero length with round caps draws a dot, so the ring reads as 24 dots.
    case 'unavailable':
      return { dash: 0, gap: RING_LENGTH / 24, offset: 0 };
    case 'healthy':
    case 'connecting':
    case 'unused':
      return { dash: RING_LENGTH, gap: RING_LENGTH, offset: 0 };
  }
}

function pickArcBand(share: number): ArcBand {
  if (share < 0.25) {
    return 'err';
  }
  return share < 0.5 ? 'warn' : 'plain';
}

// One decimal under ten seconds, whole above.
function formatSeconds(ms: number): string {
  return ms < 10_000 ? (ms / 1000).toFixed(1) : String(Math.round(ms / 1000));
}

export const networkStatusService = {
  pickChainMark,
  describeChainStatus,
  pickPendingBar,
  isWatched,
  showBars,
  landedBars,
  sameBars,
  slotOpacity,
  describeBlockDelay,
  splitDuration,
  traceArc,
};
