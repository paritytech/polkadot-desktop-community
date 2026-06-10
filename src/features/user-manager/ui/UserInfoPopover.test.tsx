// @vitest-environment happy-dom

import type * as hostPappReactUi from '@novasamatech/host-papp-react-ui';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type PropsWithChildren } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TEST_IDS } from '@/shared/test-ids';
import { TranslationProvider } from '@/shared/translation';
import type * as applicationModule from '@/domains/application';

import { type UserPopoverConnectionState, UserInfoPopover } from './UserInfoPopover';

const { navigateMock, disconnectMock, addTabMock, selectTabMock, performUserLogoutMock } = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  disconnectMock: vi.fn().mockResolvedValue(undefined),
  addTabMock: vi.fn(),
  selectTabMock: vi.fn(),
  performUserLogoutMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateMock,
}));

vi.mock('@/domains/application', async () => {
  const actual = await vi.importActual<typeof applicationModule>('@/domains/application');
  return {
    ...actual,
    performUserLogout: performUserLogoutMock,
  };
});

vi.mock('@/features/settings', () => ({
  SETTINGS: 'settings',
}));

vi.mock('@/aggregates/browser-tabs', () => ({
  browserTabs: {
    addTab: addTabMock,
    selectTab: selectTabMock,
  },
}));

vi.mock('@novasamatech/host-papp-react-ui', async () => {
  const actual = await vi.importActual<typeof hostPappReactUi>('@novasamatech/host-papp-react-ui');
  return {
    ...actual,
    useAuthentication: () => ({ disconnect: disconnectMock }),
    useSessionIdentity: () => [{ fullUsername: 'Goldie.89', liteUsername: 'Goldie' }],
  };
});

// Stable session fixture; UserInfoPopover treats it as opaque
const fakeSession = { id: 'session-1' } as NonNullable<Parameters<typeof UserInfoPopover>[0]['session']>;

const Providers = ({ children }: PropsWithChildren) => <TranslationProvider>{children}</TranslationProvider>;

const renderOpen = (
  state: UserPopoverConnectionState | 'no-connection',
  networkName = 'Paseo Next',
  session: Parameters<typeof UserInfoPopover>[0]['session'] = fakeSession,
) =>
  render(
    <Providers>
      <UserInfoPopover session={session} connectionState={state} networkName={networkName} defaultOpen>
        <button>trigger</button>
      </UserInfoPopover>
    </Providers>,
  );

describe('UserInfoPopover', () => {
  beforeEach(() => {
    navigateMock.mockClear();
    disconnectMock.mockClear();
    addTabMock.mockClear();
    selectTabMock.mockClear();
    performUserLogoutMock.mockClear();
  });

  it('renders connected banner when state=connected', () => {
    renderOpen('connected');
    const banner = screen.getByTestId(TEST_IDS.userPopoverBanner);
    expect(banner).toHaveTextContent('Connected to Paseo Next');
    expect(banner).toHaveTextContent('Desktop paired with Mobile');
  });

  it('uses the provided networkName in the banner title', () => {
    renderOpen('connected', 'Preview');
    expect(screen.getByTestId(TEST_IDS.userPopoverBanner)).toHaveTextContent('Connected to Preview');
  });

  it('renders reconnecting banner when state=reconnecting', () => {
    renderOpen('reconnecting');
    const banner = screen.getByTestId(TEST_IDS.userPopoverBanner);
    expect(banner).toHaveTextContent(/Reconnecting to Paseo Next/);
    expect(banner).toHaveTextContent('Attempting to reach the node again');
  });

  it('renders offline banner when state=offline', () => {
    renderOpen('offline');
    const banner = screen.getByTestId(TEST_IDS.userPopoverBanner);
    expect(banner).toHaveTextContent("You're offline");
    expect(banner).toHaveTextContent('Check internet connection and try again');
  });

  it('renders no-connection banner when state=no-connection', () => {
    renderOpen('no-connection', 'Paseo Next', null);
    const banner = screen.getByTestId(TEST_IDS.userPopoverBanner);
    expect(banner).toHaveTextContent('Not connected');
    expect(banner).toHaveTextContent('Log in to pair your account');
  });

  it('shows the 48px avatar in every state', () => {
    for (const state of ['connected', 'reconnecting', 'offline'] as const) {
      const { unmount } = renderOpen(state);
      expect(screen.getByTestId(TEST_IDS.userDisplayName)).toHaveTextContent('Goldie.89');
      expect(screen.getAllByText('G').length).toBeGreaterThan(0);
      unmount();
    }
  });

  it('opens the Settings tab when Settings row is clicked', async () => {
    const user = userEvent.setup();
    renderOpen('connected');
    await user.click(screen.getByTestId(TEST_IDS.userSettingsAction));
    expect(addTabMock).toHaveBeenCalledWith({ id: 'settings', type: 'settings', deeplink: '' }, { persistable: true });
    expect(selectTabMock).toHaveBeenCalledWith('settings');
    expect(navigateMock).toHaveBeenCalledWith({ to: '/settings' });
  });

  it('disconnects the host-papp session when Log out is clicked; teardown is the watcher’s job on success', async () => {
    const user = userEvent.setup();
    renderOpen('connected');
    await user.click(screen.getByTestId(TEST_IDS.userLogoutButton));
    // On success host-papp drops the session and the session-teardown watcher
    // runs the logout — the component itself does NOT call performUserLogout.
    expect(disconnectMock).toHaveBeenCalledWith(fakeSession);
    expect(performUserLogoutMock).not.toHaveBeenCalled();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('falls back to a full local logout when the disconnect send fails', async () => {
    disconnectMock.mockRejectedValueOnce(new Error('offline'));
    const user = userEvent.setup();
    renderOpen('connected');
    await user.click(screen.getByTestId(TEST_IDS.userLogoutButton));
    // A failed disconnect never removes the SDK session, so the watcher can't
    // fire — the component must tear down locally so logout always completes.
    await vi.waitFor(() => expect(performUserLogoutMock).toHaveBeenCalledTimes(1));
  });

  it('navigates to /onboarding when Log in is clicked for anonymous session', async () => {
    const user = userEvent.setup();
    renderOpen('no-connection', 'Paseo Next', null);
    await user.click(screen.getByTestId(TEST_IDS.userLogoutButton));
    expect(disconnectMock).not.toHaveBeenCalled();
    expect(navigateMock).toHaveBeenCalledWith({ to: '/onboarding' });
  });
});
