import { Avatar } from '@novasamatech/tr-ui';
import { type SessionUiInfo } from '@parity/truapi-host';
import { useNavigate } from '@tanstack/react-router';
import { LogIn, LogOut, Settings, WifiOff } from 'lucide-react';
import { type PropsWithChildren, type ReactNode, memo, useEffect, useState } from 'react';

import PolkadotLogo from '@/shared/assets/images/logo-icon.svg?jsx';
import { DismissOverlay, Popover, Spinner } from '@/shared/components';
import { TEST_IDS } from '@/shared/test-ids';
import { useTranslation } from '@/shared/translation';
import { browserTabs } from '@/aggregates/browser-tabs';
import { type PeopleChainStatus } from '@/aggregates/network-settings';
import { truapiRuntimeUseCase } from '@/aggregates/truapi-runtime';
import { SETTINGS } from '@/features/settings';

// The popover banner shows the shared chain status; the signed-out case is
// added via `| 'no-connection'` at the prop boundary below.
export type UserPopoverConnectionState = PeopleChainStatus;

type Props = PropsWithChildren<{
  session: SessionUiInfo | null;
  username: string;
  connectionState: UserPopoverConnectionState | 'no-connection';
  networkName: string;
  defaultOpen?: boolean;
}>;

const BannerIcon = ({ state }: { state: UserPopoverConnectionState | 'no-connection' }) => {
  if (state === 'offline' || state === 'no-connection') {
    return (
      <span className="flex size-12 shrink-0 items-center justify-center text-fg-secondary">
        <WifiOff className="size-10" />
      </span>
    );
  }
  if (state === 'reconnecting') {
    return (
      <span className="flex size-12 shrink-0 items-center justify-center text-fg-primary">
        <Spinner size={48} />
      </span>
    );
  }
  return (
    <span className="flex size-12 shrink-0 items-center justify-center text-fg-primary">
      <PolkadotLogo className="size-10" />
    </span>
  );
};

const StatusBanner = ({ state, networkName }: { state: UserPopoverConnectionState | 'no-connection'; networkName: string }) => {
  const { t } = useTranslation();

  const { title, subtitle } =
    state === 'connected'
      ? {
          title: t('feature.userManager.banner.connectedTitle', { networkName }),
          subtitle: t('feature.userManager.banner.connectedSubtitle'),
        }
      : state === 'reconnecting'
        ? {
            title: t('feature.userManager.banner.reconnectingTitle', { networkName }),
            subtitle: t('feature.userManager.banner.reconnectingSubtitle'),
          }
        : state === 'offline'
          ? {
              title: t('feature.userManager.banner.offlineTitle'),
              subtitle: t('feature.userManager.banner.offlineSubtitle'),
            }
          : {
              title: t('feature.userManager.banner.noConnectionTitle'),
              subtitle: t('feature.userManager.banner.noConnectionSubtitle'),
            };

  return (
    <div
      data-testid={TEST_IDS.userPopoverBanner}
      className="flex w-full items-center gap-3 overflow-clip rounded-md bg-bg-surface-nested p-2"
    >
      <BannerIcon state={state} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-base leading-6 font-medium text-fg-primary">{title}</span>
        <span className="truncate text-xs leading-4 text-fg-secondary">{subtitle}</span>
      </div>
    </div>
  );
};

const UserHeader = ({ username }: { username: string }) => {
  const letter = username.charAt(0).toUpperCase() || '?';
  return (
    <div className="flex w-full items-center gap-3 p-2">
      <span className="select-none">
        <Avatar size="48" tone="amethyst" label={letter} alt={username} />
      </span>
      <span data-testid={TEST_IDS.userDisplayName} className="truncate text-xl leading-7 font-semibold text-fg-primary">
        {username}
      </span>
    </div>
  );
};

type ActionRowProps = { icon: ReactNode; label: string; testId: string; onClick: VoidFunction };

const ActionRow = ({ icon, label, testId, onClick }: ActionRowProps) => (
  <button
    type="button"
    data-testid={testId}
    data-no-app-focus
    className="flex min-h-10 w-full items-center gap-2 rounded-lg border-0 bg-transparent px-4 py-1 text-base leading-6 font-medium text-fg-primary transition-colors outline-none hover:bg-bg-surface-nested focus:outline-none focus-visible:outline-none"
    onClick={onClick}
  >
    <span className="flex-1 text-start">{label}</span>
    <span className="flex size-4 shrink-0 items-center justify-center">{icon}</span>
  </button>
);

export const UserInfoPopover = memo(({ session, username, connectionState, networkName, defaultOpen, children }: Props) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(defaultOpen ?? false);
  const isConnected = session !== null;

  // Non-modal Radix popovers detect outside clicks via document `pointerdown`,
  // which doesn't fire when the click lands inside a product iframe nor on the
  // toolbar's -webkit-app-region: drag area. The toolbar drag area is covered by
  // <DismissOverlay/> below; window blur/resize still close on iframe focus-steal.
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener('blur', close);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('blur', close);
      window.removeEventListener('resize', close);
    };
  }, [open]);

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
        <div className="flex w-89 flex-col items-center gap-2 px-2 pt-2 pb-4">
          <StatusBanner state={connectionState} networkName={networkName} />
          <UserHeader username={username} />
          <div className="h-px w-full bg-stroke-primary" />
          <div className="flex w-full flex-col">
            <ActionRow
              icon={<Settings className="size-4" />}
              label={t('feature.userManager.popover.settings')}
              testId={TEST_IDS.userSettingsAction}
              onClick={openSettingsTab}
            />
            <ActionRow
              icon={isConnected ? <LogOut className="size-4" /> : <LogIn className="size-4" />}
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
