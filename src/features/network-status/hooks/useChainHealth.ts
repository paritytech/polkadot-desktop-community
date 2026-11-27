import { useEffect, useState } from 'react';

import { type NetworkHealth, networkHealthService } from '@/domains/network';
import { useNetworkHealth, useNetworkStatus } from '@/aggregates/network-monitor';
import { TICK_MS } from '../constants';
import { networkStatusService } from '../service';
import { type ChainWithHealth } from '../types';

export function useChainHealth(): { networkHealth: NetworkHealth; chains: ChainWithHealth[] } {
  const status = useNetworkStatus();
  const health = useNetworkHealth();
  const [now, setNow] = useState(Date.now);

  // Only a reachable chain in use ages between reads, so the clock ticks only while one shows.
  const ticking = status.chains.some(chain => networkStatusService.isWatched(chain));

  useEffect(() => {
    if (!ticking) {
      return;
    }
    const ticker = setInterval(() => setNow(Date.now()), TICK_MS);

    return () => clearInterval(ticker);
  }, [ticking]);

  const chains = status.chains.map(chain => ({
    chain,
    health: networkHealthService.describeChainHealth(
      chain,
      networkHealthService.readChainHealthFacts(chain, { network: status, health, now }),
    ),
  }));

  return { networkHealth: health, chains };
}
