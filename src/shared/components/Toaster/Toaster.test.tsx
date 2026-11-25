// @vitest-environment happy-dom

import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { TranslationProvider } from '@/shared/translation';

import { Toaster } from './Toaster';
import { toast } from './toast';

function renderToaster() {
  return render(
    <TranslationProvider>
      <Toaster />
    </TranslationProvider>,
  );
}

describe('Toaster', () => {
  it('shows each tone', async () => {
    renderToaster();

    act(() => toast.success({ title: 'Saved', description: 'All good' }));
    await screen.findByText('Saved');
    expect(screen.getByText('All good')).toBeInTheDocument();

    act(() => toast.error({ title: 'Failed', description: 'Try again' }));
    await screen.findByText('Failed');
    expect(screen.getByText('Try again')).toBeInTheDocument();

    act(() => toast.info({ title: 'Heads up', description: 'Something changed' }));
    await screen.findByText('Heads up');
    expect(screen.getByText('Something changed')).toBeInTheDocument();

    act(() => toast.message({ title: 'Hello', description: 'Just saying' }));
    await screen.findByText('Hello');
    expect(screen.getByText('Just saying')).toBeInTheDocument();
  });

  it('fills the toaster column with a card outside the drag region', async () => {
    renderToaster();

    act(() => toast.success({ title: 'Saved' }));
    const title = await screen.findByText('Saved');

    expect(title.closest('[data-sonner-toast]')).toHaveClass('w-full');
    expect(title.parentElement?.parentElement?.style.getPropertyValue('app-region')).toBe('no-drag');
  });

  it('runs an action without dismissing', async () => {
    const user = userEvent.setup();
    const actionSpy = vi.fn();
    const dismissSpy = vi.fn();
    renderToaster();

    act(() => toast.message({ title: 'Update', action: { label: 'Open', onClick: actionSpy }, onDismiss: dismissSpy }));
    await screen.findByText('Update');

    await user.click(screen.getByRole('button', { name: 'Open' }));

    expect(actionSpy).toHaveBeenCalledOnce();
    await waitFor(() => expect(screen.queryByText('Update')).not.toBeInTheDocument());
    expect(dismissSpy).not.toHaveBeenCalled();
  });

  it('runs onDismiss from its close button', async () => {
    const user = userEvent.setup();
    const dismissSpy = vi.fn();
    renderToaster();

    act(() => toast.message({ title: 'Later', onDismiss: dismissSpy }));
    await screen.findByText('Later');

    await user.click(screen.getByRole('button', { name: 'Close' }));

    await waitFor(() => expect(dismissSpy).toHaveBeenCalledOnce());
  });

  it('replaces a toast with the same id', async () => {
    renderToaster();

    act(() => toast.info({ id: 'one', title: 'First' }));
    act(() => toast.info({ id: 'one', title: 'Second' }));

    await screen.findByText('Second');
    expect(screen.queryByText('First')).toBeNull();
  });
});
