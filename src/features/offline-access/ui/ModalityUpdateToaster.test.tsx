// @vitest-environment happy-dom

import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Toaster, toast } from '@/shared/components';
import { TranslationProvider } from '@/shared/translation';
import { onProductModalityOpenedSideEffect, updatesUseCase } from '@/domains/product';
// eslint-disable-next-line boundaries/dependencies -- the test observes the write where it lands; the barrel exposes no seam for it
import { declinedUpdatesRepository } from '@/domains/product/product/declined-updates/repository';
import { offlineAccessDialogTarget } from '../state/dialogState';

import { ModalityUpdateToaster } from './ModalityUpdateToaster';

// `checkModalityUpdate` reaches `productDb` and the declined-updates repository directly,
// so the use case is spied in place; the decline is observed where it lands, on the
// repository, so the real `useDeclineUpdate` and its TLD normalisation run.
const checkModalityUpdateMock = vi.spyOn(updatesUseCase, 'checkModalityUpdate');
const recordDecline = vi.spyOn(declinedUpdatesRepository, 'record').mockResolvedValue();

const renderToaster = () =>
  render(
    <TranslationProvider>
      <ModalityUpdateToaster />
      <Toaster />
    </TranslationProvider>,
  );

async function findToast(title: string) {
  const heading = await screen.findByText(title);

  return heading.closest<HTMLElement>('[data-sonner-toast]')!;
}

// sonner renders each toast a macrotask after it is raised, in call order: once a marker raised
// now is on screen, any toast raised before it is too, so a "not shown" assertion is not vacuous.
async function settleToasts() {
  act(() => toast.info({ title: 'marker' }));
  await screen.findByText('marker');
}

afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe('ModalityUpdateToaster', () => {
  it('raises a persistent Update toast when the opened modality has an undeclined update', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    checkModalityUpdateMock
      .mockResolvedValueOnce({ contenthash: '0xnew', version: [1, 0, 1] })
      .mockResolvedValueOnce({ contenthash: '0xnewer', version: [1, 0, 2] });
    renderToaster();

    await onProductModalityOpenedSideEffect.apply({ productId: 'app.dot', kind: 'app' });

    expect(checkModalityUpdateMock).toHaveBeenCalledWith({ baseName: 'app.dot', kind: 'app' });
    await screen.findByText('App update available');
    act(() => vi.advanceTimersByTime(10_000));
    expect(screen.getByText('App update available')).toBeInTheDocument();

    await onProductModalityOpenedSideEffect.apply({ productId: 'app.dot', kind: 'app' });

    // The re-check reuses the toast's id, so the newer version replaces the reminder instead of stacking.
    await screen.findByText('Version 1.0.2 is ready to install');
    expect(screen.getAllByText('App update available')).toHaveLength(1);
    expect(screen.queryByText('Version 1.0.1 is ready to install')).toBeNull();
  });

  it('Update action opens the per-modality confirm dialog', async () => {
    checkModalityUpdateMock.mockResolvedValue({ contenthash: '0xnew', version: [1, 0, 1] });
    renderToaster();
    await onProductModalityOpenedSideEffect.apply({ productId: 'app.dot', kind: 'widget' });

    const toastElement = await findToast('Widget update available');
    await userEvent.click(within(toastElement).getByRole('button', { name: 'Update' }));

    // The dialog is feature state, so the assertion reads the real target.
    expect(offlineAccessDialogTarget.get()).toEqual({ kind: 'updateExecutable', productId: 'app.dot', executableKind: 'widget' });
    await waitFor(() => expect(screen.queryByText('Widget update available')).toBeNull());
    expect(recordDecline).not.toHaveBeenCalled();
  });

  it('dismiss records a decline for that exact version', async () => {
    checkModalityUpdateMock.mockResolvedValue({ contenthash: '0xnew', version: [1, 0, 1] });
    renderToaster();
    await onProductModalityOpenedSideEffect.apply({ productId: 'app.dot', kind: 'worker' });

    const toastElement = await findToast('Background services (e.g. Chat rooms) update available');
    await userEvent.click(within(toastElement).getByRole('button', { name: 'Close' }));

    // The decline resolves the active TLD first, so the write lands a tick later.
    await waitFor(() =>
      expect(recordDecline).toHaveBeenCalledWith({
        baseName: 'app.dot',
        kind: 'worker',
        contenthash: '0xnew',
        version: [1, 0, 1],
      }),
    );
  });

  it('raises no toast when the modality has no update', async () => {
    checkModalityUpdateMock.mockResolvedValue(null);
    renderToaster();
    await onProductModalityOpenedSideEffect.apply({ productId: 'app.dot', kind: 'app' });

    await settleToasts();
    expect(screen.queryByText('App update available')).toBeNull();
  });
});
