// @vitest-environment happy-dom

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { TranslationProvider } from '@/shared/translation';

import { RemotePermissionRequestDialog } from './RemotePermissionRequestDialog';

const defaultHandlers = {
  onAllowAlways: vi.fn(),
  onAllowOnce: vi.fn(),
  onDeny: vi.fn(),
  onDismiss: vi.fn(),
};

const renderDialog = (props: Parameters<typeof RemotePermissionRequestDialog>[0]) =>
  render(
    <TranslationProvider>
      <RemotePermissionRequestDialog {...props} />
    </TranslationProvider>,
  );

describe('RemotePermissionRequestDialog', () => {
  it('shows the product id', () => {
    renderDialog({
      isOpen: true,
      productId: 'my-app.dot',
      permission: 'Remote',
      values: ['https://*.example.com'],
      ...defaultHandlers,
    });
    expect(screen.getByText(/my-app\.dot/)).toBeTruthy();
  });

  it('shows the permission string in the domains box', () => {
    renderDialog({
      isOpen: true,
      productId: 'my-app.dot',
      permission: 'Remote',
      values: ['https://*.example.com'],
      ...defaultHandlers,
    });
    expect(screen.getByText('Domains')).toBeTruthy();
    expect(screen.getByText(/https:\/\/\*\.example\.com/)).toBeTruthy();
  });

  it('shows Web Domains title and connection description for external URL permission', () => {
    renderDialog({
      isOpen: true,
      productId: 'my-app.dot',
      permission: 'Remote',
      values: ['https://*.example.com'],
      ...defaultHandlers,
    });
    expect(screen.getByText('Allow Access to Web Domains?')).toBeTruthy();
    expect(screen.getByText('Used to make requests to the following domains')).toBeTruthy();
    expect(document.querySelector('.bg-bg-illustration-light')).toBeNull();
  });

  it('treats wss URLs as external requests (Web Domains)', () => {
    renderDialog({
      isOpen: true,
      productId: 'my-app.dot',
      permission: 'Remote',
      values: ['wss://rpc.polkadot.io'],
      ...defaultHandlers,
    });
    expect(screen.getByText('Allow Access to Web Domains?')).toBeTruthy();
    expect(screen.getByText(/wss:\/\/rpc\.polkadot\.io/)).toBeTruthy();
  });

  it('calls onAllowOnce when Allow Once is clicked', async () => {
    const onAllowOnce = vi.fn();
    renderDialog({
      isOpen: true,
      productId: 'my-app.dot',
      permission: 'Remote',
      values: ['https://*.example.com'],
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
      permission: 'Remote',
      values: ['https://*.example.com'],
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
      permission: 'Remote',
      values: ['https://*.example.com'],
      ...defaultHandlers,
      onDeny,
    });
    await userEvent.click(screen.getByRole('button', { name: /don't allow/i }));
    expect(onDeny).toHaveBeenCalled();
  });

  it('calls onDismiss when dialog is closed via Escape', async () => {
    const onDismiss = vi.fn();
    const onDeny = vi.fn();
    renderDialog({
      isOpen: true,
      productId: 'my-app.dot',
      permission: 'Remote',
      values: ['https://*.example.com'],
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
      permission: 'Remote',
      values: ['https://*.example.com'],
      ...defaultHandlers,
    });
    expect(screen.queryByRole('button', { name: /close/i })).toBeNull();
  });
});
