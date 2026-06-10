import { type Identity } from '@novasamatech/host-papp';
import { useSession, useSessionIdentity } from '@novasamatech/host-papp-react-ui';
import { Tooltip } from '@novasamatech/tr-ui';
import { memo } from 'react';

import { TEST_IDS } from '@/shared/test-ids';
import { useTranslation } from '@/shared/translation';
import { usePeopleChainStatus } from '@/aggregates/network-settings';

import { type ConnectionState, ConnectionStatus } from './ConnectionStatus';
import { UserInfoPopover } from './UserInfoPopover';

const firstLetter = (identity: Identity | null | undefined): string => {
  const source = identity?.fullUsername ?? identity?.liteUsername ?? '';
  return source.charAt(0).toUpperCase() || '?';
};

const useConnectionStatusLabel = (state: ConnectionState): string => {
  const { t } = useTranslation();
  switch (state) {
    case 'connected':
      return t('feature.userManager.connectionStatus.connected');
    case 'reconnecting':
      return t('feature.userManager.connectionStatus.reconnecting');
    case 'offline':
      return t('feature.userManager.connectionStatus.offline');
    case 'no-connection':
      return t('feature.userManager.connectionStatus.noConnection');
  }
};

export const UserButton = memo(() => {
  const { session } = useSession();
  const { status: peopleChainStatus, networkName } = usePeopleChainStatus();

  const [identity] = useSessionIdentity(session);
  const letter = firstLetter(identity);

  // The chain status is already the badge's state verbatim; the badge only adds
  // the signed-out case. No re-classification.
  const state: ConnectionState = session ? peopleChainStatus : 'no-connection';

  const statusLabel = useConnectionStatusLabel(state);
  const { t } = useTranslation();

  return (
    <Tooltip.Provider delayDuration={300}>
      <Tooltip>
        <div className="inline-flex items-center" data-testid={TEST_IDS.userButton}>
          <UserInfoPopover
            session={session}
            connectionState={session ? peopleChainStatus : 'no-connection'}
            networkName={networkName}
          >
            <Tooltip.Trigger asChild>
              <button
                type="button"
                aria-label={session ? t('feature.userManager.aria.account') : t('feature.userManager.aria.connectAccount')}
                className="inline-flex h-8 items-center"
              >
                <ConnectionStatus state={state} letter={state === 'no-connection' ? 'N' : letter} />
              </button>
            </Tooltip.Trigger>
          </UserInfoPopover>
        </div>
        {state !== 'connected' && <Tooltip.Content side="bottom">{statusLabel}</Tooltip.Content>}
      </Tooltip>
    </Tooltip.Provider>
  );
});
