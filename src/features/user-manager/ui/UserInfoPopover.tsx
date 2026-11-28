import { type SessionUiInfo } from '@parity/truapi-host';
import { useNavigate } from '@tanstack/react-router';
import { type PropsWithChildren, type ReactNode, memo, useState } from 'react';

import { Avatar, DismissOverlay, Popover } from '@/shared/components';
import { useCloseOnWindowLeave } from '@/shared/hooks';
import { LogInIcon, LogOutIcon, SettingsIcon } from '@/shared/icons';
import { TEST_IDS } from '@/shared/test-ids';
import { useTranslation } from '@/shared/translation';
import { browserTabs } from '@/aggregates/browser-tabs';
import { truapiRuntimeUseCase } from '@/aggregates/truapi-runtime';
import { SETTINGS } from '@/features/settings';

type Props = PropsWithChildren<{
  session: SessionUiInfo | null;
  name: string | null;
  defaultOpen?: boolean;
}>;

const UserHeader = ({ session, name }: { session: SessionUiInfo | null; name: string | null }) => {
  const { t } = useTranslation();
  const displayName = session ? (name ?? t('common.status.unknownUser')) : t('feature.userManager.popover.signedOut');

  return (
    <div className="flex w-full items-center gap-2 p-2">
      <Avatar size="40" label={name ?? ''} />
      <div className="flex min-w-0 flex-col">
        {session && <span className="text-xs text-fg-secondary">{t('feature.userManager.popover.signedInAs')}</span>}
        <span data-testid={TEST_IDS.userDisplayName} className="line-clamp-2 text-lg font-semibold wrap-anywhere text-fg-primary">
          {displayName}
        </span>
      </div>
    </div>
  );
};

type ActionRowProps = { icon: ReactNode; label: string; testId: string; onClick: VoidFunction };

const ActionRow = ({ icon, label, testId, onClick }: ActionRowProps) => (
  <button
    type="button"
    data-testid={testId}
    data-no-app-focus
    className="flex min-h-control w-full items-center gap-2 rounded-lg border-0 bg-transparent px-4 text-sm font-medium text-fg-primary transition-colors outline-none hover:bg-bg-surface-nested focus:outline-none focus-visible:outline-none"
    onClick={onClick}
  >
    <span className="flex-1 text-start">{label}</span>
    <span className="flex size-4 shrink-0 items-center justify-center">{icon}</span>
  </button>
);

export const UserInfoPopover = memo(({ session, name, defaultOpen, children }: Props) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(defaultOpen ?? false);
  const isConnected = session !== null;

  useCloseOnWindowLeave(open, () => setOpen(false));

  const openSettingsTab = () => {
    setOpen(false);
    browserTabs.addTab({ id: SETTINGS, type: SETTINGS, deeplink: '' }, { persistable: true });
    browserTabs.selectTab(SETTINGS);
    navigate({ to: '/settings' });
  };

  const handleAuthAction = () => {
    setOpen(false);
    if (!session) {
      navigate({ to: '/onboarding' });
      return;
    }

    // The core drops the session whether or not the wallet could be notified, and
    // `watchCoreSessionTeardown` turns that Connected -> Disconnected transition
    // into the full local logout.
    truapiRuntimeUseCase.disconnectSession().catch((error: unknown) => {
      console.error('[sso] logout disconnect failed', error);
    });
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <DismissOverlay open={open} testId={TEST_IDS.dismissOverlay} onDismiss={() => setOpen(false)} />
      <Popover.Trigger asChild>{children}</Popover.Trigger>
      <Popover.Content sideOffset={8} align="end" alignOffset={8}>
        <div className="flex w-64 flex-col items-center gap-2 p-2">
          <UserHeader session={session} name={name} />
          <div className="h-px w-full bg-stroke-primary" />
          <div className="flex w-full flex-col">
            <ActionRow
              icon={<SettingsIcon className="size-4" />}
              label={t('feature.userManager.popover.settings')}
              testId={TEST_IDS.userSettingsAction}
              onClick={openSettingsTab}
            />
            <ActionRow
              icon={isConnected ? <LogOutIcon className="size-4" /> : <LogInIcon className="size-4" />}
              label={isConnected ? t('feature.user.logOut') : t('feature.user.logIn')}
              testId={TEST_IDS.userLogoutButton}
              onClick={handleAuthAction}
            />
          </div>
        </div>
      </Popover.Content>
    </Popover.Root>
  );
});
