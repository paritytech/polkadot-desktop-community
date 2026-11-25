import { memo } from 'react';

import { Tooltip } from '@/shared/components';
import { TEST_IDS } from '@/shared/test-ids';
import { useTranslation } from '@/shared/translation';
import { useConsumerIdentity } from '@/domains/network';
import { usePeopleChainStatus } from '@/aggregates/network-settings';
import { useTruapiSession, useTruapiUserId } from '@/aggregates/truapi-runtime';

import { type ConnectionState, ConnectionStatus } from './ConnectionStatus';
import { UserInfoPopover } from './UserInfoPopover';

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
  const session = useTruapiSession();
  const userId = useTruapiUserId();
  const { data: identity } = useConsumerIdentity(userId);
  const { status: peopleChainStatus, networkName } = usePeopleChainStatus();
  const { t } = useTranslation();

  // Resolve the signed-in user's name off the People chain — the same source a chat
  // peer's name comes from. The core's session projection is only a fallback for the
  // brief window before that read settles.
  const resolvedName = identity?.fullUsername ?? identity?.liteUsername ?? session?.fullUsername ?? session?.liteUsername ?? null;
  const username = resolvedName ?? t('common.status.unknownUser');
  const letter = resolvedName?.charAt(0).toUpperCase() || '?';

  // The chain status is already the badge's state verbatim; the badge only adds
  // the signed-out case. No re-classification.
  const state: ConnectionState = session ? peopleChainStatus : 'no-connection';

  const statusLabel = useConnectionStatusLabel(state);

  return (
    <Tooltip.Provider delayDuration={300}>
      <Tooltip.Root>
        <div className="inline-flex items-center" data-testid={TEST_IDS.userButton}>
          <UserInfoPopover
            session={session}
            username={username}
            connectionState={session ? peopleChainStatus : 'no-connection'}
            networkName={networkName}
          >
            <Tooltip.Trigger asChild>
              <button
                type="button"
                aria-label={session ? t('feature.userManager.aria.account') : t('feature.userManager.aria.connectAccount')}
                className="inline-flex h-8 cursor-pointer items-center"
              >
                <ConnectionStatus state={state} letter={state === 'no-connection' ? 'N' : letter} />
              </button>
            </Tooltip.Trigger>
          </UserInfoPopover>
        </div>
        {state !== 'connected' && <Tooltip.Content side="bottom">{statusLabel}</Tooltip.Content>}
      </Tooltip.Root>
    </Tooltip.Provider>
  );
});
