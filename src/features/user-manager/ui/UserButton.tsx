import { memo } from 'react';

import { Avatar, IconButton } from '@/shared/components';
import { TEST_IDS } from '@/shared/test-ids';
import { useTranslation } from '@/shared/translation';
import { useConsumerIdentity } from '@/domains/network';
import { useTruapiSession, useTruapiUserId } from '@/aggregates/truapi-runtime';

import { UserInfoPopover } from './UserInfoPopover';

export const UserButton = memo(() => {
  const session = useTruapiSession();
  const userId = useTruapiUserId();
  const { data: identity } = useConsumerIdentity(userId);
  const { t } = useTranslation();

  // Resolve the signed-in user's name off the People chain — the same source a chat
  // peer's name comes from. The core's session projection is only a fallback for the
  // brief window before that read settles.
  const name = identity?.fullUsername ?? identity?.liteUsername ?? session?.fullUsername ?? session?.liteUsername ?? null;
  const label = session ? t('feature.userManager.aria.account') : t('feature.userManager.aria.connectAccount');

  return (
    <UserInfoPopover session={session} name={name}>
      <IconButton label={label} title={label} data-testid={TEST_IDS.userButton}>
        <Avatar size="24" label={name ?? ''} />
      </IconButton>
    </UserInfoPopover>
  );
});
