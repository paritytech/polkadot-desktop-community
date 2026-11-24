// @vitest-environment happy-dom

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { TEST_IDS } from '@/shared/test-ids';
import { TranslationProvider } from '@/shared/translation';
import { type P2PChatRequest } from '@/domains/chat';

import { OutgoingPendingRoom } from './OutgoingPendingRoom';

const request: P2PChatRequest = {
  requestId: 'req-1',
  peerId: '0xpeer',
  peerUsername: 'mysticRiver.88',
  direction: 'outgoing',
  status: 'pending',
  welcomeMessage: 'Hi there',
  timestamp: Date.now(),
  userId: '0xuser',
  lastUpdate: 0,
};

const renderRoom = (onCancel = vi.fn<(request: P2PChatRequest) => Promise<void>>().mockResolvedValue(undefined)) => {
  render(
    <TranslationProvider>
      <OutgoingPendingRoom request={request} onCancel={onCancel} />
    </TranslationProvider>,
  );

  return onCancel;
};

const openDialog = async () => {
  await userEvent.click(screen.getByRole('button', { expanded: false }));
  await userEvent.click(await screen.findByRole('menuitem', { name: 'Cancel request' }));
};

describe('OutgoingPendingRoom', () => {
  it('opens the cancel confirmation from the header menu', async () => {
    renderRoom();

    await openDialog();

    expect(await screen.findByTestId(TEST_IDS.chatCancelRequestDialog)).toBeInTheDocument();
    expect(screen.getByText('mysticRiver.88 will no longer see your request.')).toBeInTheDocument();
  });

  it('keeps the request on Keep request', async () => {
    const onCancel = renderRoom();

    await openDialog();
    await userEvent.click(await screen.findByRole('button', { name: 'Keep request' }));

    await waitFor(() => expect(screen.queryByTestId(TEST_IDS.chatCancelRequestDialog)).not.toBeInTheDocument());
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('closes the dialog before the cancel settles', async () => {
    renderRoom(vi.fn<(request: P2PChatRequest) => Promise<void>>(() => new Promise<void>(() => {})));

    await openDialog();
    await userEvent.click(await screen.findByTestId(TEST_IDS.chatCancelRequestDialogConfirm));

    await waitFor(() => expect(screen.queryByTestId(TEST_IDS.chatCancelRequestDialog)).not.toBeInTheDocument());
  });

  it('cancels on confirm', async () => {
    const onCancel = renderRoom();

    await openDialog();
    await userEvent.click(await screen.findByTestId(TEST_IDS.chatCancelRequestDialogConfirm));

    await waitFor(() => expect(onCancel).toHaveBeenCalledExactlyOnceWith(request));
    await waitFor(() => expect(screen.queryByTestId(TEST_IDS.chatCancelRequestDialog)).not.toBeInTheDocument());
  });
});
