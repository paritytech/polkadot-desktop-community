import { type ChainActivity } from '@/shared/chain-connection';
import { type Chain } from '../chain/types';

import { EXTRA_BLOCK_TIME_MS, MAX_BARS, ROLE_BLOCK_TIME_MS } from './constants';
import {
  type BlockBar,
  type BlockHealth,
  type ChainClock,
  type ChainLifecycle,
  type ChainPhase,
  type ChainStatus,
  type KnownChain,
  type KnownChainRole,
  type MonitoredChain,
  type NetworkMonitorModel,
} from './types';

type Side = 'known' | 'extras';

type LocatedChain = {
  genesis: string;
  side: Side;
  current: MonitoredChain;
};

function createModel(known: readonly KnownChain[]): NetworkMonitorModel {
  return {
    known: new Map(
      known.map(({ role, chain }) => [
        chain.genesisHash.toLowerCase(),
        createMonitoredChain(chain, role, ROLE_BLOCK_TIME_MS[role]),
      ]),
    ),
    extras: new Map(),
  };
}

// A chain outside the known roles is listed only while something holds it. A chain not `connected` stops its block
// clock, so its next block draws no bar.
function recordChainActivity(model: NetworkMonitorModel, activity: ChainActivity<Chain>): NetworkMonitorModel {
  const genesis = activity.chain.genesisHash.toLowerCase();
  let located = findChain(model, genesis);
  if (located === null) {
    if (activity.consumers === 0) {
      return model;
    }
    located = { genesis, side: 'extras', current: createMonitoredChain(activity.chain, null, EXTRA_BLOCK_TIME_MS) };
  }
  const { current } = located;
  const released = current.consumers > 0 && activity.consumers === 0;
  if (released && current.role === null) {
    const extras = new Map(model.extras);
    extras.delete(genesis);
    return { known: model.known, extras };
  }
  // A consumer can drop its follow and keep the chain. No block is coming then, so the clock stops rather than reading
  // the chain as overdue, and a later follow carries the bars on from its next block. A gap across a drop, or across
  // the unused stretch after a release, is no measure of block production either. A released known chain keeps its
  // bars as the record of its last use.
  const stopsClock = (current.following && !activity.following) || activity.status !== 'connected' || released;
  return patchChain(model, located, {
    consumers: activity.consumers,
    status: activity.status,
    following: activity.following,
    lastAt: stopsClock ? null : current.lastAt,
  });
}

// Ignored for a chain nobody holds, so a late block cannot revive a released chain's history. A block on a chain not
// `connected`, or whose phase is `connecting` or `syncing`, leaves the block clock stopped and draws no bar, so the
// clock starts at the first block after the chain is up.
function recordBestBlock(model: NetworkMonitorModel, genesisHash: string, blockNumber: number, now: number): NetworkMonitorModel {
  const located = findChain(model, genesisHash.toLowerCase());
  if (located === null || located.current.consumers === 0) {
    return model;
  }
  const { current } = located;
  // A reorg can repeat a number or go lower, and must not add a bar.
  if (current.latest !== null && blockNumber <= current.latest) {
    return model;
  }
  if (current.status !== 'connected' || isPhaseDown(current.phase)) {
    return patchChain(model, located, { latest: blockNumber });
  }
  // The first block has no gap to judge, so it only anchors the next one.
  const bars = current.lastAt === null ? current.bars : appendBar(current, blockNumber, now - current.lastAt);
  return patchChain(model, located, { latest: blockNumber, lastAt: now, bars });
}

// Acts on known chains only. `null` means the light client no longer watches the chain, such as after a switch to RPC.
function recordLightClientLifecycle(
  model: NetworkMonitorModel,
  genesisHash: string,
  lifecycle: ChainLifecycle | null,
): NetworkMonitorModel {
  const genesis = genesisHash.toLowerCase();
  const current = model.known.get(genesis);
  if (current === undefined) {
    return model;
  }
  const located: LocatedChain = { genesis, side: 'known', current };
  if (lifecycle === null) {
    return patchChain(model, located, { phase: null, syncShare: null, peers: null });
  }
  const phase: ChainPhase = lifecycle.health.kind === 'stalled' ? 'stalled' : lifecycle.phase.kind;
  // A client coming up again has no block production to measure until its next block.
  const stopsClock = isPhaseDown(phase) && phase !== current.phase;
  return patchChain(model, located, {
    phase,
    syncShare: readSyncShare(lifecycle.phase) ?? current.syncShare,
    peers: lifecycle.peers,
    lastAt: stopsClock ? null : current.lastAt,
  });
}

// Copies no bars, so it stays cheap to read on every change.
function readChainClocks(model: NetworkMonitorModel, isReachable: (chain: Chain) => boolean, now: number): ChainClock[] {
  return listChains(model).map(([genesis, monitored]) => readClock(genesis, monitored, isReachable, now));
}

// Every known chain, then each other chain something holds, each with its own frozen copy of the bars.
function readNetworkStatus(model: NetworkMonitorModel, isReachable: (chain: Chain) => boolean, now: number): ChainStatus[] {
  return listChains(model).map(([genesis, monitored]) => ({
    ...readClock(genesis, monitored, isReachable, now),
    role: monitored.role,
    name: monitored.chain.name,
    bars: Object.freeze([...monitored.bars]),
    phase: monitored.phase,
    syncShare: monitored.syncShare,
    peers: monitored.peers,
  }));
}

function createMonitoredChain(chain: Chain, role: KnownChainRole | null, blockTimeMs: number): MonitoredChain {
  return {
    chain,
    role,
    blockTimeMs,
    bars: [],
    latest: null,
    lastAt: null,
    consumers: 0,
    status: 'disconnected',
    following: false,
    phase: null,
    syncShare: null,
    peers: null,
  };
}

function findChain(model: NetworkMonitorModel, genesis: string): LocatedChain | null {
  const known = model.known.get(genesis);
  if (known !== undefined) {
    return { genesis, side: 'known', current: known };
  }
  const extra = model.extras.get(genesis);
  return extra === undefined ? null : { genesis, side: 'extras', current: extra };
}

// Returns the model it was given when nothing changes, so a state holding it does not emit.
function patchChain(
  model: NetworkMonitorModel,
  { genesis, side, current }: LocatedChain,
  changes: Partial<MonitoredChain>,
): NetworkMonitorModel {
  const next: MonitoredChain = { ...current, ...changes };
  if (isSameChain(current, next)) {
    return model;
  }
  if (side === 'known') {
    return { known: new Map(model.known).set(genesis, next), extras: model.extras };
  }
  return { known: model.known, extras: new Map(model.extras).set(genesis, next) };
}

function isSameChain(a: MonitoredChain, b: MonitoredChain): boolean {
  return (
    a.chain === b.chain &&
    a.role === b.role &&
    a.blockTimeMs === b.blockTimeMs &&
    a.bars === b.bars &&
    a.latest === b.latest &&
    a.lastAt === b.lastAt &&
    a.consumers === b.consumers &&
    a.status === b.status &&
    a.following === b.following &&
    a.phase === b.phase &&
    a.syncShare === b.syncShare &&
    a.peers === b.peers
  );
}

function appendBar(current: MonitoredChain, blockNumber: number, gapMs: number): BlockBar[] {
  const bar: BlockBar = { number: blockNumber, health: classifyGap(gapMs, current.blockTimeMs), gapMs };
  return [...current.bars, bar].slice(-MAX_BARS);
}

function classifyGap(gapMs: number, blockTimeMs: number): BlockHealth {
  if (gapMs <= blockTimeMs * 1.5) {
    return 'onTime';
  }
  return gapMs <= blockTimeMs * 3 ? 'late' : 'veryLate';
}

function isPhaseDown(phase: ChainPhase | null): boolean {
  return phase === 'connecting' || phase === 'syncing';
}

// The share of its warp sync a syncing chain has proven, or null when the sample has no usable target.
function readSyncShare(phase: ChainLifecycle['phase']): number | null {
  if (phase.kind === 'syncing' && phase.target > 0 && phase.at <= phase.target) {
    return phase.at / phase.target;
  }
  return null;
}

function listChains(model: NetworkMonitorModel): [string, MonitoredChain][] {
  return [...model.known, ...model.extras];
}

// An extra was handed to the app by whoever holds it, so only a known chain can lack an endpoint on the active network.
function isChainReachable(monitored: MonitoredChain, isReachable: (chain: Chain) => boolean): boolean {
  return monitored.role === null || isReachable(monitored.chain);
}

// Read from the pool's status and the light client's phase only. Neither the blocks nor overdue blocks are judged here.
function judgeUse(monitored: MonitoredChain, reachable: boolean): Pick<ChainStatus, 'state' | 'alarm'> {
  // A released chain stays connected through the pool's grace period with no lease, so a chain only counts while held.
  if (!reachable || monitored.consumers === 0) {
    return { state: 'unused', alarm: false };
  }
  const alarm = monitored.phase === 'stalled';
  switch (monitored.status) {
    case 'disconnected':
      return { state: 'down', alarm };
    case 'connecting':
      return { state: 'pending', alarm };
    case 'connected':
      return { state: isPhaseDown(monitored.phase) ? 'pending' : 'live', alarm };
  }
}

function readClock(genesis: string, monitored: MonitoredChain, isReachable: (chain: Chain) => boolean, now: number): ChainClock {
  const reachable = isChainReachable(monitored, isReachable);
  return {
    genesisHash: genesis,
    latest: monitored.latest,
    sinceLast: monitored.lastAt === null ? null : now - monitored.lastAt,
    blockTimeMs: monitored.blockTimeMs,
    reachable,
    ...judgeUse(monitored, reachable),
  };
}

export const networkMonitorService = {
  createModel,
  recordChainActivity,
  recordBestBlock,
  recordLightClientLifecycle,
  readChainClocks,
  readNetworkStatus,
};
