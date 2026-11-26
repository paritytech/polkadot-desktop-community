import { Badge, SegmentedControl } from '@/shared/components';
import { TEST_IDS } from '@/shared/test-ids';
import { useTranslation } from '@/shared/translation';
import { type Environment } from '@/domains/application';
import { type Chain, type ConnectionMode, connectionService, useChainConnectionMode } from '@/domains/network';
import { networkConnectionService } from '../service';

type Props = {
  chain: Chain;
  environment: Environment | null;
  onModeRequested: (chain: Chain, mode: ConnectionMode) => void;
};

export const ChainConnectionRow = ({ chain, environment, onModeRequested }: Props) => {
  const { t } = useTranslation();
  const mode = useChainConnectionMode(chain.genesisHash);

  const roles = networkConnectionService.rolesForChain(chain.genesisHash, environment);

  const handleChange = (raw: string) => {
    if (!connectionService.isConnectionMode(raw) || raw === mode.effective) return;

    onModeRequested(chain, raw);
  };

  return (
    <div data-testid={TEST_IDS.networkConnectionChainRow} className="flex items-center gap-4 rounded-xl py-2 pr-3 pl-10">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate text-sm text-fg-primary">{chain.name}</span>
        <div className="flex items-center gap-1">
          {roles.map(role => (
            <Badge key={role}>{t(`feature.networkConnection.role.${role}`)}</Badge>
          ))}
          {/* A network the active stack lists no light spec for cannot serve a light client — say so rather than leaving an
              option that silently resolves to the other one. */}
          {!mode.lightClientAvailable && (
            <span className="truncate text-xs text-fg-tertiary">{t('feature.networkConnection.noLightClient')}</span>
          )}
        </div>
      </div>
      {/* `effective`, not `requested`: a network that cannot serve a light client
          must show the option it is actually on, not the one it asked for. */}
      <div className="shrink-0">
        <SegmentedControl.Root label={chain.name} value={mode.effective} onChange={handleChange}>
          <SegmentedControl.Item value="light-client" disabled={!mode.lightClientAvailable}>
            {t('feature.networkConnection.mode.lightClient')}
          </SegmentedControl.Item>
          <SegmentedControl.Item value="rpc">{t('feature.networkConnection.mode.rpc')}</SegmentedControl.Item>
        </SegmentedControl.Root>
      </div>
    </div>
  );
};
