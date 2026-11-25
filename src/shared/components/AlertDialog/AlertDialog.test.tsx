// @vitest-environment happy-dom

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { AlertDialog } from './AlertDialog';

const renderAlertDialog = ({
  onOpenChange = vi.fn(),
  onCancel = vi.fn(),
  onAction = vi.fn(),
  variant,
}: {
  onOpenChange?: (open: boolean) => void;
  onCancel?: VoidFunction;
  onAction?: VoidFunction;
  variant?: 'primary' | 'danger';
} = {}) => {
  render(
    <AlertDialog.Root open onOpenChange={onOpenChange}>
      <AlertDialog.Content>
        <AlertDialog.Header>
          <AlertDialog.Title>Log out?</AlertDialog.Title>
          <AlertDialog.Description>Text</AlertDialog.Description>
        </AlertDialog.Header>
        <AlertDialog.Footer>
          <AlertDialog.Cancel onClick={onCancel}>Stay</AlertDialog.Cancel>
          <AlertDialog.Action variant={variant} onClick={onAction}>
            Leave
          </AlertDialog.Action>
        </AlertDialog.Footer>
      </AlertDialog.Content>
    </AlertDialog.Root>,
  );
};

describe('AlertDialog', () => {
  it('is an alert dialog named by its title', async () => {
    renderAlertDialog();

    const dialog = await screen.findByRole('alertdialog', { name: 'Log out?' });

    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute('data-modal-surface');
    expect(dialog.style.getPropertyValue('app-region')).toBe('no-drag');
  });

  it('cancels', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const onCancel = vi.fn();
    renderAlertDialog({ onOpenChange, onCancel });

    await user.click(await screen.findByRole('button', { name: 'Stay' }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('acts', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const onAction = vi.fn();
    renderAlertDialog({ onOpenChange, onAction });

    await user.click(await screen.findByRole('button', { name: 'Leave' }));

    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('draws a danger action', async () => {
    renderAlertDialog({ variant: 'danger' });

    const action = await screen.findByRole('button', { name: 'Leave' });

    expect(action.classList.contains('bg-chrome-danger-fill')).toBe(true);
  });
});
