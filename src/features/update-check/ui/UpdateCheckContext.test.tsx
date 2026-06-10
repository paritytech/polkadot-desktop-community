// @vitest-environment happy-dom

import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TranslationProvider } from '@/shared/translation';

import { UpdateCheckProvider, useUpdateCheck } from './UpdateCheckContext';

type UpdateEventCallback = (event: { type: string; data?: unknown }) => void;
type CheckForUpdatesRequestCallback = () => void;

let updateEventCallback: UpdateEventCallback;
let checkForUpdatesRequestCallback: CheckForUpdatesRequestCallback;

const mockCheckForUpdates = vi.fn().mockResolvedValue(undefined);
const mockQuitAndInstall = vi.fn();
const mockOnUpdateEvent = vi.fn((cb: UpdateEventCallback) => {
  updateEventCallback = cb;
  return vi.fn();
});
const mockOnCheckForUpdatesRequest = vi.fn((cb: CheckForUpdatesRequestCallback) => {
  checkForUpdatesRequestCallback = cb;
  return vi.fn();
});

function mockWindowApp(overrides?: Partial<typeof window.App>) {
  Object.defineProperty(window, 'App', {
    value: {
      isAutoUpdateSupported: true,
      checkForUpdates: mockCheckForUpdates,
      quitAndInstall: mockQuitAndInstall,
      onUpdateEvent: mockOnUpdateEvent,
      onCheckForUpdatesRequest: mockOnCheckForUpdatesRequest,
      ...overrides,
    },
    writable: true,
    configurable: true,
  });
}

const CheckButton = () => {
  const { openUpdateCheck } = useUpdateCheck();
  return <button onClick={openUpdateCheck}>Check</button>;
};

const renderProvider = () =>
  render(
    <TranslationProvider>
      <UpdateCheckProvider>
        <CheckButton />
      </UpdateCheckProvider>
    </TranslationProvider>,
  );

function emitUpdateEvent(type: string, data?: unknown) {
  act(() => {
    updateEventCallback({ type, data });
  });
}

describe('UpdateCheckContext', () => {
  beforeEach(() => {
    mockCheckForUpdates.mockClear();
    mockQuitAndInstall.mockClear();
    mockOnUpdateEvent.mockClear();
    mockOnCheckForUpdatesRequest.mockClear();
    localStorage.clear();
    mockWindowApp();
  });

  afterEach(() => {
    // @ts-expect-error — cleanup global
    delete window.App;
  });

  describe('manual check via button', () => {
    it('opens modal and calls checkForUpdates when button is clicked', async () => {
      renderProvider();

      await userEvent.click(screen.getByText('Check'));

      expect(mockCheckForUpdates).toHaveBeenCalledOnce();
      expect(screen.getByText('Checking for updates…')).toBeTruthy();
    });

    it('does nothing when isAutoUpdateSupported is false', async () => {
      mockWindowApp({ isAutoUpdateSupported: false });
      renderProvider();

      await userEvent.click(screen.getByText('Check'));

      expect(mockCheckForUpdates).not.toHaveBeenCalled();
    });
  });

  describe('manual check events (modal flow)', () => {
    it('shows downloading in modal on update-available after manual check', async () => {
      renderProvider();

      await userEvent.click(screen.getByText('Check'));
      emitUpdateEvent('update-available', { version: '2.0.0' });

      expect(screen.getByText('Downloading update…')).toBeTruthy();
    });

    it('shows ready-to-install in modal on update-downloaded after manual check', async () => {
      renderProvider();

      await userEvent.click(screen.getByText('Check'));
      emitUpdateEvent('update-downloaded', { version: '2.0.0' });

      expect(screen.getByText('Update ready to install')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Restart now' })).toBeTruthy();
    });

    it('shows error in modal after manual check', async () => {
      renderProvider();

      await userEvent.click(screen.getByText('Check'));
      emitUpdateEvent('error', { message: 'Network timeout' });

      expect(screen.getByText('Network timeout')).toBeTruthy();
    });
  });

  describe('auto-check events (toast flow)', () => {
    it('shows toast on update-downloaded from auto-check', async () => {
      renderProvider();

      emitUpdateEvent('update-downloaded', { version: '2.0.0' });
      await act(async () => {});

      expect(screen.getByText('Update available')).toBeTruthy();
      expect(screen.getByText('Version 2.0.0 is ready to install')).toBeTruthy();
    });

    it('does not show toast when version is dismissed', async () => {
      localStorage.setItem('dismissed_update_version', '2.0.0');
      renderProvider();

      emitUpdateEvent('update-downloaded', { version: '2.0.0' });
      await act(async () => {});

      expect(screen.queryByText('Update available')).toBeNull();
    });

    it('shows toast when a different version is dismissed', async () => {
      localStorage.setItem('dismissed_update_version', '1.9.0');
      renderProvider();

      emitUpdateEvent('update-downloaded', { version: '2.0.0' });
      await act(async () => {});

      expect(screen.getByText('Update available')).toBeTruthy();
    });

    it('does not show modal on update-available from auto-check', () => {
      renderProvider();

      emitUpdateEvent('update-available', { version: '2.0.0' });

      expect(screen.queryByText('Downloading update…')).toBeNull();
    });

    it('does not show modal on update-downloaded from auto-check', async () => {
      renderProvider();

      emitUpdateEvent('update-downloaded', { version: '2.0.0' });
      await act(async () => {});

      // Toast should be visible, but not the modal buttons
      expect(screen.getByText('Update available')).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Restart now' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Later' })).toBeNull();
    });
  });

  describe('toast actions', () => {
    it('saves dismissed version and hides toast on Dismiss', async () => {
      renderProvider();

      emitUpdateEvent('update-downloaded', { version: '2.0.0' });
      await act(async () => {});

      await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));

      expect(localStorage.getItem('dismissed_update_version')).toBe('2.0.0');
      expect(screen.queryByText('Update available')).toBeNull();
    });

    it('calls quitAndInstall on Install', async () => {
      renderProvider();

      emitUpdateEvent('update-downloaded', { version: '2.0.0' });
      await act(async () => {});

      await userEvent.click(screen.getByRole('button', { name: 'Install' }));

      expect(mockQuitAndInstall).toHaveBeenCalledOnce();
    });

    it('shows error state in toast when install fails', async () => {
      renderProvider();

      emitUpdateEvent('update-downloaded', { version: '2.0.0' });
      await act(async () => {});

      await userEvent.click(screen.getByRole('button', { name: 'Install' }));
      emitUpdateEvent('error', { message: 'Code signature failed' });

      expect(screen.getByText('Update failed')).toBeTruthy();
      expect(screen.getByText('Please contact the development team')).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Install' })).toBeNull();
      expect(screen.getByRole('button', { name: 'Dismiss' })).toBeTruthy();
    });
  });

  describe('install actions (modal)', () => {
    it('calls quitAndInstall when Restart now is clicked', async () => {
      renderProvider();

      await userEvent.click(screen.getByText('Check'));
      emitUpdateEvent('update-downloaded', { version: '2.0.0' });

      await userEvent.click(screen.getByRole('button', { name: 'Restart now' }));
      expect(mockQuitAndInstall).toHaveBeenCalledOnce();
    });

    it('closes modal when Later is clicked', async () => {
      renderProvider();

      await userEvent.click(screen.getByText('Check'));
      emitUpdateEvent('update-downloaded', { version: '2.0.0' });
      expect(screen.getByText('Update ready to install')).toBeTruthy();

      await userEvent.click(screen.getByRole('button', { name: 'Later' }));
      expect(screen.queryByText('Update ready to install')).toBeNull();
    });
  });

  describe('menu request', () => {
    it('opens modal when onCheckForUpdatesRequest fires', () => {
      renderProvider();

      act(() => {
        checkForUpdatesRequestCallback();
      });

      expect(mockCheckForUpdates).toHaveBeenCalledOnce();
      expect(screen.getByText('Checking for updates…')).toBeTruthy();
    });
  });

  describe('restores last event on manual open', () => {
    it('restores update-not-available without re-checking', async () => {
      renderProvider();

      emitUpdateEvent('update-not-available');

      await userEvent.click(screen.getByText('Check'));

      expect(screen.getByText("You're up to date")).toBeTruthy();
      expect(mockCheckForUpdates).not.toHaveBeenCalled();
    });

    it('restores update-downloaded without re-checking', async () => {
      renderProvider();

      emitUpdateEvent('update-downloaded', { version: '2.0.0' });
      await act(async () => {});

      await userEvent.click(screen.getByText('Check'));

      expect(screen.getByText('Update ready to install')).toBeTruthy();
      expect(mockCheckForUpdates).not.toHaveBeenCalled();
    });
  });
});
