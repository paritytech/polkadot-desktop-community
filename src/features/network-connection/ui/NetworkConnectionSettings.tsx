import { memo, useMemo } from 'react';

import { RadioGroup, SettingsList } from '@/shared/components';
import { useTranslation } from '@/shared/translation';
import { useActiveEnvironment } from '@/domains/application';
import {
  type Chain,
  type ConnectionMode,
  connectionService,
  useAllChainsMap,
  useConnectionSettings,
  useSetChainConnectionMode,
  useSetConnectionPreference,
} from '@/domains/network';

import { ChainConnectionRow } from './ChainConnectionRow';

export const NetworkConnectionSettings = memo(() => {
  const { t } = useTranslation();
  const { data: settings } = useConnectionSettings();
  const setPreference = useSetConnectionPreference();
  const setChainMode = useSetChainConnectionMode();
  const { data: chains, pending: chainsPending } = useAllChainsMap();
  const { data: environment } = useActiveEnvironment();

  const chainList = useMemo(() => Object.values(chains).sort((a, b) => a.name.localeCompare(b.name)), [chains]);

  // Both writes apply straight away: the open connections are moved onto the new
  // transport in place, so there is nothing to confirm and nothing to restart.
  const handlePreferenceChange = (raw: string) => {
    if (!connectionService.isConnectionPreference(raw) || raw === settings.preference) return;

    setPreference.run({ preference: raw });
  };

  const handleChainModeRequested = (chain: Chain, mode: ConnectionMode) => {
    setChainMode.run({ chainId: chain.genesisHash, mode });
  };

  return (
    <SettingsList title={t('feature.networkConnection.title')}>
      <div className="flex flex-col gap-1">
        <RadioGroup.Root
          label={t('feature.networkConnection.title')}
          value={settings.preference}
          onValueChange={handlePreferenceChange}
        >
          <RadioGroup.Item
            value="light-client"
            title={t('feature.networkConnection.mode.lightClient')}
            description={t('feature.networkConnection.mode.lightClientHint')}
          />
          <RadioGroup.Item
            value="rpc"
            title={t('feature.networkConnection.mode.rpc')}
            description={t('feature.networkConnection.mode.rpcHint')}
          />
          <RadioGroup.Item
            value="advanced"
            title={t('feature.networkConnection.advanced.title')}
            description={t('feature.networkConnection.advanced.description')}
          />
        </RadioGroup.Root>

        {settings.preference === 'advanced' && (
          <div className="flex flex-col">
            {chainList.map(chain => (
              <ChainConnectionRow
                key={chain.genesisHash}
                chain={chain}
                environment={environment}
                onModeRequested={handleChainModeRequested}
              />
            ))}
            {chainList.length === 0 && (
              <p className="py-2 pl-10 text-sm text-fg-tertiary">
                {chainsPending ? t('feature.networkConnection.chainsLoading') : t('feature.networkConnection.chainsEmpty')}
              </p>
            )}
          </div>
        )}
      </div>
    </SettingsList>
  );
});

NetworkConnectionSettings.displayName = 'NetworkConnectionSettings';
