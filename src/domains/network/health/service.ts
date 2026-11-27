import { type ChainClock, type ChainStatus } from '../monitor/types';

import { MIN_STALL_BLOCKS, MIN_STALL_MS, OVERDUE_BLOCK_TIMES } from './constants';
import { type ChainHealth, type ChainHealthFacts, type LiveVerdict, type NetworkHealth, type NetworkStatus } from './types';

type HealthChain = Pick<ChainStatus, 'reachable' | 'state' | 'bars' | 'blockTimeMs' | 'sinceLast' | 'phase' | 'syncShare'>;

type ReadChainHealthFactsParams = {
  network: Pick<NetworkStatus, 'readAt' | 'verdict'>;
  health: NetworkHealth;
  now: number;
};

// Judges only the chains in use or pending, by each chain's state, alarm and time since its last block, never a
// connection milestone, so the verdict cannot latch on a dead connection. A network that offers no endpoint for any of
// its chains is unreachable, whatever uses them.
function describeLiveNetwork(chains: readonly ChainClock[]): LiveVerdict {
  if (chains.length > 0 && chains.every(chain => !chain.reachable)) {
    return { health: 'unreachable' };
  }
  const counted = chains.filter(chain => chain.state !== 'unused');
  if (counted.length === 0) {
    return { health: 'unused' };
  }
  const slow = counted.filter(chain => chain.alarm || isOverdue(chain)).map(chain => chain.genesisHash);
  if (slow.length > 0) {
    return { health: 'unstable', slow };
  }
  const live = counted.filter(chain => chain.state === 'live').length;
  if (live < counted.length) {
    return { health: 'syncing' };
  }
  return { health: 'connected' };
}

function judgeNetworkHealth(chains: readonly ChainClock[], online: boolean): NetworkHealth {
  return online ? describeLiveNetwork(chains).health : 'offline';
}

function isNetworkOffline(health: NetworkHealth): boolean {
  switch (health) {
    case 'offline':
      return true;
    case 'connected':
    case 'syncing':
    case 'unstable':
    case 'unused':
    case 'unreachable':
      return false;
  }
}

// When the verdict next changes with no event: the first on-time live chain going overdue. Null when none can.
function getNextOverdueAt(chains: readonly ChainClock[], now: number): number | null {
  let at: number | null = null;
  for (const chain of chains) {
    if (chain.state !== 'live' || chain.alarm || chain.sinceLast === null) {
      continue;
    }
    const limit = chain.blockTimeMs * OVERDUE_BLOCK_TIMES;
    if (chain.sinceLast <= limit) {
      const due = now - chain.sinceLast + limit;
      at = at === null ? due : Math.min(at, due);
    }
  }
  return at;
}

function readChainHealthFacts(
  chain: Pick<ChainStatus, 'genesisHash'>,
  { network, health, now }: ReadChainHealthFactsParams,
): ChainHealthFacts {
  return {
    sinceRead: now - network.readAt,
    behind: network.verdict.slow?.includes(chain.genesisHash) === true,
    offline: isNetworkOffline(health),
    unreachable: network.verdict.health === 'unreachable',
  };
}

// The first match wins: offline, no endpoint, unused, disconnected, coming up, then production.
function describeChainHealth(chain: HealthChain, { sinceRead, behind, offline, unreachable }: ChainHealthFacts): ChainHealth {
  if (offline) {
    return { kind: 'offline' };
  }
  if (!chain.reachable) {
    return { kind: 'noEndpoint', networkUnreachable: unreachable };
  }
  if (chain.state === 'unused') {
    return { kind: 'unused' };
  }
  if (chain.state === 'down') {
    return { kind: 'disconnected' };
  }
  // A clock that stepped back since the read must not make the last block younger than it was.
  const sinceLast = chain.sinceLast === null ? null : chain.sinceLast + Math.max(0, sinceRead);
  // The monitor's verdict and the light client's phase say whether the chain is up, never the bars it keeps. A warp in
  // progress wins over a connected pool or blocks already landing.
  if (chain.phase === 'syncing') {
    return { kind: 'syncing', syncShare: chain.syncShare, sinceLast };
  }
  if (chain.state === 'pending' || chain.phase === 'connecting') {
    return { kind: 'connecting', sinceLast };
  }
  return describeProduction(chain, sinceLast, behind);
}

function describeProduction(chain: HealthChain, sinceLast: number | null, behind: boolean): ChainHealth {
  if (sinceLast !== null && isStalled(chain.blockTimeMs, sinceLast)) {
    return { kind: 'stalled', behind, sinceLast };
  }
  const measured = measureBlockTime(chain.bars);
  // Blocks a catching-up client hears back to back are not faster production, so the share never exceeds 1.
  const liveShare = measured === null ? null : Math.min(1, chain.blockTimeMs / measured);
  return { kind: 'producing', behind, sinceLast, liveShare };
}

function isOverdue(chain: ChainClock): boolean {
  return chain.state === 'live' && chain.sinceLast !== null && chain.sinceLast > chain.blockTimeMs * OVERDUE_BLOCK_TIMES;
}

function isStalled(blockTimeMs: number, sinceLast: number): boolean {
  return sinceLast >= Math.max(MIN_STALL_MS, MIN_STALL_BLOCKS * blockTimeMs);
}

// The mean of the last two block intervals, null until two bars exist.
function measureBlockTime(bars: HealthChain['bars']): number | null {
  const [previous, newest] = bars.slice(-2);
  return previous === undefined || newest === undefined ? null : (previous.gapMs + newest.gapMs) / 2;
}

export const networkHealthService = {
  describeLiveNetwork,
  judgeNetworkHealth,
  isNetworkOffline,
  getNextOverdueAt,
  readChainHealthFacts,
  describeChainHealth,
};
