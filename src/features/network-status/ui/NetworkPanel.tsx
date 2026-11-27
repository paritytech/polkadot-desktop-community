import { type FC } from 'react';

import { TEST_IDS } from '@/shared/test-ids';
import { useTranslation } from '@/shared/translation';
import { HEALTH_TONES } from '../constants';
import { useChainHealth } from '../hooks/useChainHealth';
import { type ChainWithHealth } from '../types';

import { ChainList } from './ChainList';
import { ChainRow } from './ChainRow';
import { OtherChains } from './OtherChains';
import { StatusDot } from './StatusDot';

export const NetworkPanel: FC = () => {
  const { t } = useTranslation();
  const { networkHealth, chains } = useChainHealth();

  const knownChains = chains.filter(({ chain }) => chain.role !== null);
  const otherChains = chains.filter(({ chain }) => chain.role === null);

  const renderRow = ({ chain, health }: ChainWithHealth) => <ChainRow key={chain.genesisHash} chain={chain} health={health} />;

  return (
    <section data-testid={TEST_IDS.networkPanel} className="flex w-80 flex-col gap-2 p-3">
      <div className="flex items-center justify-between gap-2 px-1">
        <h2 className="text-lg font-semibold">{t('feature.networkStatus.title')}</h2>
        <StatusDot tone={HEALTH_TONES[networkHealth]} label={t(`feature.networkStatus.health.${networkHealth}`)} />
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
