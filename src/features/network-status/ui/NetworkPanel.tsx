import { type FC, useEffect, useState } from 'react';

import { TEST_IDS } from '@/shared/test-ids';
import { useTranslation } from '@/shared/translation';
import { type ChainStatus, networkHealthService } from '@/domains/network';
import { useNetworkHealth, useNetworkStatus } from '@/aggregates/network-monitor';
import { HEALTH_TONES, TICK_MS } from '../constants';
import { networkStatusService } from '../service';

import { ChainList } from './ChainList';
import { ChainRow } from './ChainRow';
import { OtherChains } from './OtherChains';
import { StatusDot } from './StatusDot';

export const NetworkPanel: FC = () => {
  const { t } = useTranslation();
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

  const knownChains = status.chains.filter(chain => chain.role !== null);
  const otherChains = status.chains.filter(chain => chain.role === null);

  const renderRow = (chain: ChainStatus) => (
    <ChainRow
      key={chain.genesisHash}
      chain={chain}
      health={networkHealthService.describeChainHealth(
        chain,
        networkHealthService.readChainHealthFacts(chain, { network: status, health, now }),
      )}
    />
  );

  return (
    <section data-testid={TEST_IDS.networkPanel} className="flex w-80 flex-col gap-2 p-3">
      <div className="flex items-center justify-between gap-2 px-1 pt-0.5">
        <h2 className="text-lg font-semibold">{t('feature.networkStatus.title')}</h2>
        <StatusDot tone={HEALTH_TONES[health]} label={t(`feature.networkStatus.health.${health}`)} />
      </div>
      {knownChains.length > 0 && <ChainList testId={TEST_IDS.networkChainList}>{knownChains.map(renderRow)}</ChainList>}
      {otherChains.length > 0 && (
        <OtherChains count={otherChains.length}>
          <ChainList testId={TEST_IDS.networkOtherChainList}>{otherChains.map(renderRow)}</ChainList>
        </OtherChains>
      )}
    </section>
  );
};
