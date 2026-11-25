// @vitest-environment happy-dom

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { TranslationProvider } from '@/shared/translation';
import { Popover } from '../Popover/Popover';

import { Dialog } from './Dialog';

const renderDialog = ({
  onOpenChange = vi.fn(),
  showCloseButton,
  title = <Dialog.Title>Rename</Dialog.Title>,
}: {
  onOpenChange?: (open: boolean) => void;
  showCloseButton?: boolean;
  title?: ReactNode;
} = {}) => {
  render(
    <TranslationProvider>
      <Dialog.Root open onOpenChange={onOpenChange}>
        <Dialog.Content aria-describedby={undefined} showCloseButton={showCloseButton}>
          {title}
        </Dialog.Content>
      </Dialog.Root>
    </TranslationProvider>,
  );
};

describe('Dialog', () => {
  it('is named by its title', async () => {
    renderDialog();

    expect(await screen.findByRole('dialog', { name: 'Rename' })).toBeInTheDocument();
  });

  it('closes from its close button', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    renderDialog({ onOpenChange });

    await user.click(await screen.findByRole('button', { name: 'Close' }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('can drop its close button', async () => {
    renderDialog({ showCloseButton: false });

    await screen.findByRole('dialog', { name: 'Rename' });

    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();
  });

  it('marks its card for the modal workarounds and keeps a reduced-motion exit', async () => {
    renderDialog();

    const dialog = await screen.findByRole('dialog', { name: 'Rename' });

    expect(dialog).toHaveAttribute('data-modal-surface');
    expect(dialog.style.getPropertyValue('app-region')).toBe('no-drag');
    expect(dialog.classList.contains('motion-reduce:[animation-duration:0.01ms]')).toBe(true);
    expect(dialog.classList.contains('motion-reduce:data-[state=closed]:[animation-duration:0.01ms]')).toBe(true);
  });

  it('keeps its title clear of the close button', async () => {
    renderDialog();

    const dialog = await screen.findByRole('dialog', { name: 'Rename' });

    expect(dialog).toHaveAttribute('data-closable');
    expect(screen.getByRole('heading', { name: 'Rename' })).toHaveClass('group-data-[closable]/dialog:pe-8');
  });

  it('is not closable without its close button', async () => {
    renderDialog({ showCloseButton: false });

    const dialog = await screen.findByRole('dialog', { name: 'Rename' });

    expect(dialog).not.toHaveAttribute('data-closable');
  });

  it("pads a caller's asChild title for the close button", async () => {
    renderDialog({
      title: (
        <Dialog.Title asChild>
          <span>Plain</span>
        </Dialog.Title>
      ),
    });

    await screen.findByRole('dialog', { name: 'Plain' });

    expect(screen.getByText('Plain')).toHaveClass('group-data-[closable]/dialog:pe-8');
  });

  it('closes only itself on Escape when opened inside a popover', async () => {
    const user = userEvent.setup();
    const onPopoverOpenChange = vi.fn();
    const onDialogOpenChange = vi.fn();
    render(
      <TranslationProvider>
        <Popover.Root open onOpenChange={onPopoverOpenChange}>
          <Popover.Content>
            <Dialog.Root open onOpenChange={onDialogOpenChange}>
              <Dialog.Content aria-describedby={undefined}>
                <Dialog.Title>Rename</Dialog.Title>
              </Dialog.Content>
            </Dialog.Root>
          </Popover.Content>
        </Popover.Root>
      </TranslationProvider>,
    );
    await screen.findByRole('dialog', { name: 'Rename' });

    await user.keyboard('{Escape}');

    expect(onDialogOpenChange).toHaveBeenCalledWith(false);
    expect(onPopoverOpenChange).not.toHaveBeenCalled();
  });

  it("keeps a caller's asChild title", async () => {
    renderDialog({
      title: (
        <Dialog.Title asChild>
          <span>Plain</span>
        </Dialog.Title>
      ),
    });

    const dialog = await screen.findByRole('dialog', { name: 'Plain' });
    const title = screen.getByText('Plain');

    expect(title.tagName).toBe('SPAN');
    expect(dialog.querySelector('h2')).toBeNull();
  });
});
