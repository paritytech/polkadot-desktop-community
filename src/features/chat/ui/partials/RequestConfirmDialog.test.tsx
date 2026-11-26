// @vitest-environment happy-dom

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { RequestConfirmDialog } from './RequestConfirmDialog';

const renderDialog = ({ onClose = vi.fn(), onConfirm = vi.fn() } = {}) => {
  render(
    <RequestConfirmDialog
      isOpen
      title="Decline request?"
      description="Body"
      cancelLabel="Keep"
      confirmLabel="Decline"
      testId="dialog"
      confirmTestId="dialog-confirm"
      onClose={onClose}
      onConfirm={onConfirm}
    />,
  );
};

describe('RequestConfirmDialog', () => {
  it('closes once on Cancel', async () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();
    renderDialog({ onClose, onConfirm });

    await userEvent.click(await screen.findByRole('button', { name: 'Keep' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('confirms without closing, leaving the close to the caller', async () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();
    renderDialog({ onClose, onConfirm });

    await userEvent.click(await screen.findByTestId('dialog-confirm'));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByTestId('dialog')).toBeInTheDocument();
  });
});
