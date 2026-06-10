// @vitest-environment happy-dom

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { TranslationProvider } from '@/shared/translation';

import { PermissionDeniedDialog } from './PermissionDeniedDialog';

const renderDialog = (props: Parameters<typeof PermissionDeniedDialog>[0]) =>
  render(
    <TranslationProvider>
      <PermissionDeniedDialog {...props} />
    </TranslationProvider>,
  );

describe('PermissionDeniedDialog', () => {
  it('shows the correct title for Camera', () => {
    renderDialog({
      permission: 'Camera',
      deniedAt: 'app',
      onOpenPrimarySettings: vi.fn(),
      onClose: vi.fn(),
    });
    expect(screen.getByText('Camera Access Required')).toBeTruthy();
  });

  it('shows the correct title for Microphone', () => {
    renderDialog({
      permission: 'Microphone',
      deniedAt: 'app',
      onOpenPrimarySettings: vi.fn(),
      onClose: vi.fn(),
    });
    expect(screen.getByText('Microphone Access Required')).toBeTruthy();
  });

  it('shows the correct title for Notifications', () => {
    renderDialog({
      permission: 'Notifications',
      deniedAt: 'app',
      onOpenPrimarySettings: vi.fn(),
      onClose: vi.fn(),
    });
    expect(screen.getByText('Notification Access Required')).toBeTruthy();
    expect(screen.getByText('Used to send you updates, alerts and important information')).toBeTruthy();
  });

  it('shows the correct title for Biometrics', () => {
    renderDialog({
      permission: 'Biometrics',
      deniedAt: 'app',
      onOpenPrimarySettings: vi.fn(),
      onClose: vi.fn(),
    });
    expect(screen.getByText('Biometrics Access Required')).toBeTruthy();
    expect(screen.getByText('Used for features that require verifying your identity')).toBeTruthy();
  });

  it('shows the correct title for Clipboard', () => {
    renderDialog({
      permission: 'Clipboard',
      deniedAt: 'app',
      onOpenPrimarySettings: vi.fn(),
      onClose: vi.fn(),
    });
    expect(screen.getByText('Clipboard Access Required')).toBeTruthy();
    expect(screen.getByText('Used for copying and pasting content you choose to share')).toBeTruthy();
  });

  it('shows the correct title for Files', () => {
    renderDialog({
      permission: 'Files',
      deniedAt: 'app',
      onOpenPrimarySettings: vi.fn(),
      onClose: vi.fn(),
    });
    expect(screen.getByText('Disk Access Required')).toBeTruthy();
    expect(screen.getByText('Used for features like uploading, downloading and managing files')).toBeTruthy();
  });

  it('shows the correct title for OpenUrl', () => {
    renderDialog({
      permission: 'OpenUrl',
      deniedAt: 'app',
      onOpenPrimarySettings: vi.fn(),
      onClose: vi.fn(),
    });
    expect(screen.getByText('External Link Access Required')).toBeTruthy();
    expect(screen.getByText('Used to open external links in your default browser')).toBeTruthy();
  });

  it('shows the correct title for ExternalRequest', () => {
    renderDialog({
      permission: 'ExternalRequest',
      deniedAt: 'app',
      onOpenPrimarySettings: vi.fn(),
      onClose: vi.fn(),
    });
    expect(screen.getByText('Web Domains Access Required')).toBeTruthy();
  });

  it('shows ExternalRequest copy and icon when permission tag is Remote', () => {
    renderDialog({
      permission: 'Remote',
      deniedAt: 'app',
      onOpenPrimarySettings: vi.fn(),
      onClose: vi.fn(),
    });
    expect(screen.getByText('Web Domains Access Required')).toBeTruthy();
    expect(screen.getByText('Used to make requests to the following domains')).toBeTruthy();
    expect(document.querySelector('.bg-bg-illustration-light')).toBeTruthy();
  });

  it('shows ExternalRequest copy when permission is a URL (remote external link)', () => {
    renderDialog({
      permission: 'https://example.com/path',
      deniedAt: 'app',
      onOpenPrimarySettings: vi.fn(),
      onClose: vi.fn(),
    });
    expect(screen.getByText('Web Domains Access Required')).toBeTruthy();
    expect(screen.queryByText('https://example.com/path')).toBeNull();
  });

  it('falls back to generic title for unknown permissions', () => {
    renderDialog({
      permission: 'SomethingElse',
      deniedAt: 'app',
      onOpenPrimarySettings: vi.fn(),
      onClose: vi.fn(),
    });
    expect(screen.getByText('Access Required')).toBeTruthy();
  });

  it('calls onClose when Cancel is clicked', async () => {
    const onClose = vi.fn();
    renderDialog({
      permission: 'Camera',
      deniedAt: 'app',
      onOpenPrimarySettings: vi.fn(),
      onClose,
    });
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onOpenPrimarySettings and onClose when App settings is clicked', async () => {
    const onOpenPrimarySettings = vi.fn();
    const onClose = vi.fn();
    renderDialog({
      permission: 'Camera',
      deniedAt: 'app',
      onOpenPrimarySettings,
      onClose,
    });
    await userEvent.click(screen.getByRole('button', { name: /app settings/i }));
    expect(onOpenPrimarySettings).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalled();
  });

  it('shows Device settings label when deniedAt is system', () => {
    renderDialog({
      permission: 'Camera',
      deniedAt: 'system',
      onOpenPrimarySettings: vi.fn(),
      onClose: vi.fn(),
    });
    expect(screen.getByRole('button', { name: /device settings/i })).toBeTruthy();
  });
});
