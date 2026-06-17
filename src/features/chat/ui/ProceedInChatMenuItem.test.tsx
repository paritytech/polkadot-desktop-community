// @vitest-environment happy-dom

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const openProceedInChatDialogMock = vi.fn();
const openChatRoomMock = vi.fn();
const useProductRoomsMock = vi.fn(() => ({ data: [] as { sessionId: string; roomId: string }[], pending: false, error: null }));

vi.mock('../state/proceedInChatDialog', () => ({
  openProceedInChatDialog: (...args: unknown[]) => openProceedInChatDialogMock(...args),
}));

vi.mock('../hooks/useOpenProductChatRoom', () => ({
  useOpenProductChatRoom: () => openChatRoomMock,
}));

vi.mock('@/domains/chat', () => ({
  useProductRooms: () => useProductRoomsMock(),
}));

vi.mock('@/domains/product', () => ({
  useDisplayedProduct: (productId: string) => ({
    data: {
      baseName: productId,
      displayName: 'My App',
      executables: { worker: { includes: { chat: true } } },
    },
    pending: false,
    error: null,
  }),
}));

vi.mock('@/features/product-actions-menu', () => ({
  MenuItem: ({ label, onSelect }: { label: ReactNode; onSelect: () => void }) => <button onClick={onSelect}>{label}</button>,
}));

import { TranslationProvider } from '@/shared/translation';

import { ProceedInChatMenuItem } from './ProceedInChatMenuItem';

const PRODUCT_ID = 'my-app.dot';

const renderItem = () =>
  render(
    <TranslationProvider>
      <ProceedInChatMenuItem productId={PRODUCT_ID} closeMenu={vi.fn()} />
    </TranslationProvider>,
  );

describe('ProceedInChatMenuItem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useProductRoomsMock.mockReturnValue({ data: [], pending: false, error: null });
  });

  it('opens the confirmation dialog when no chat room exists yet', async () => {
    renderItem();

    await userEvent.click(screen.getByText('Proceed in Chat'));

    expect(openProceedInChatDialogMock).toHaveBeenCalledWith(PRODUCT_ID);
    expect(openChatRoomMock).not.toHaveBeenCalled();
  });

  it('navigates directly to the chat room when it already exists', async () => {
    useProductRoomsMock.mockReturnValue({
      data: [{ sessionId: '0xsession', roomId: 'my-app' }],
      pending: false,
      error: null,
    });
    renderItem();

    await userEvent.click(screen.getByText('Proceed in Chat'));

    expect(openChatRoomMock).toHaveBeenCalledWith('0xsession');
    expect(openProceedInChatDialogMock).not.toHaveBeenCalled();
  });
});
