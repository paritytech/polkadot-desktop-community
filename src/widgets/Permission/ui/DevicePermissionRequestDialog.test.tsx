// @vitest-environment happy-dom

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { TranslationProvider } from '@/shared/translation';

import { DevicePermissionRequestDialog } from './DevicePermissionRequestDialog';

const defaultHandlers = {
  onAllowAlways: vi.fn(),
  onAllowOnce: vi.fn(),
  onDeny: vi.fn(),
  onDismiss: vi.fn(),
};

const renderDialog = (props: Parameters<typeof DevicePermissionRequestDialog>[0]) =>
  render(
    <TranslationProvider>
      <DevicePermissionRequestDialog {...props} />
    </TranslationProvider>,
  );

describe('DevicePermissionRequestDialog', () => {
  it('shows the permission label for a known device permission', () => {
    renderDialog({
      isOpen: true,
      productId: 'my-app.dot',
      permission: 'Microphone',
      ...defaultHandlers,
    });
    expect(screen.getByText(/Microphone/i)).toBeTruthy();
    expect(screen.getByText(/my-app\.dot/i)).toBeTruthy();
  });

  it('shows the permission label for another known permission key', () => {
    renderDialog({
      isOpen: true,
      productId: 'my-app.dot',
      permission: 'Remote',
      ...defaultHandlers,
    });
    expect(screen.getByRole('heading', { name: /Web Domains/i })).toBeTruthy();
  });

  it('shows i18n message id fallback in the title when the permission key is unknown', () => {
    renderDialog({
      isOpen: true,
      productId: 'my-app.dot',
      permission: 'UnknownPerm',
      ...defaultHandlers,
    });
    expect(screen.getByRole('heading')).toHaveTextContent(/UnknownPerm/);
  });

  it('calls onAllowOnce when Allow Once is clicked', async () => {
    const onAllowOnce = vi.fn();
    renderDialog({
      isOpen: true,
      productId: 'my-app.dot',
      permission: 'Camera',
      ...defaultHandlers,
      onAllowOnce,
    });
    await userEvent.click(screen.getByRole('button', { name: /allow once/i }));
    expect(onAllowOnce).toHaveBeenCalledOnce();
  });

  it('calls onAllowAlways when Always Allow is clicked', async () => {
    const onAllowAlways = vi.fn();
    renderDialog({
      isOpen: true,
      productId: 'my-app.dot',
      permission: 'Camera',
      ...defaultHandlers,
      onAllowAlways,
    });
    await userEvent.click(screen.getByRole('button', { name: /always allow/i }));
    expect(onAllowAlways).toHaveBeenCalledOnce();
  });

  it("calls onDeny when Don't Allow is clicked", async () => {
    const onDeny = vi.fn();
    renderDialog({
      isOpen: true,
      productId: 'my-app.dot',
      permission: 'Camera',
      ...defaultHandlers,
      onDeny,
    });
    await userEvent.click(screen.getByRole('button', { name: /don't allow/i }));
    expect(onDeny).toHaveBeenCalled();
  });

  it('calls onDismiss when the dialog is closed via Escape', async () => {
    const onDismiss = vi.fn();
    const onDeny = vi.fn();
    renderDialog({
      isOpen: true,
      productId: 'my-app.dot',
      permission: 'Camera',
      ...defaultHandlers,
      onDeny,
      onDismiss,
    });
    await userEvent.keyboard('{Escape}');
    expect(onDismiss).toHaveBeenCalled();
    expect(onDeny).not.toHaveBeenCalled();
  });

  it('does not render a top close button', () => {
    renderDialog({
      isOpen: true,
      productId: 'my-app.dot',
      permission: 'Camera',
      ...defaultHandlers,
    });
    expect(screen.queryByRole('button', { name: /close/i })).toBeNull();
  });
});
