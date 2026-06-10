// @vitest-environment happy-dom

import { toastError, toastWithAction } from '@novasamatech/tr-ui';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { TranslationProvider } from '@/shared/translation';

import { ProceedInChatDialog } from './ProceedInChatDialog';

vi.mock('@novasamatech/tr-ui', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@novasamatech/tr-ui');
  return {
    ...actual,
    toastWithAction: vi.fn(),
    toastError: vi.fn(),
  };
});

const navigateMock = vi.fn();
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateMock,
}));

const runMock = vi.fn();
vi.mock('@/domains/chat', () => ({
  useCreateProductRoom: () => ({ run: runMock, pending: false, status: null }),
  useCurrentUserPeer: () => ({
    data: { type: 'user', accountId: '0xuser' as const, name: 'U' },
    pending: false,
  }),
  useProductRooms: () => ({ data: [{ roomId: 'coin-flip' }], pending: false, error: null }),
  productChatService: {
    getSessionId: () => '0xsession',
  },
}));

vi.mock('@/domains/product', () => ({
  useDisplayedProduct: (productId: string) => ({
    data: {
      baseName: productId,
      displayName: 'Coin Flip',
      description: '',
      icon: { cid: 'bafy123', format: 'png' },
      executables: {},
    },
    pending: false,
    error: null,
  }),
  useProductIcon: () => ({ data: null, pending: false, error: null }),
  useProductHeaderProps: ({
    product,
    fallbackName = '',
    fallbackDomain = fallbackName,
  }: {
    product: { displayName?: string; baseName?: string } | null;
    fallbackName?: string;
    fallbackDomain?: string;
  }) => ({
    name: product?.displayName ?? fallbackName,
    description: product?.baseName ?? fallbackDomain,
    iconSrc: undefined,
  }),
}));

const GATED_PRODUCT_ID = 'coinflipgame03.dot';

const renderDialog = (open = true) =>
  render(
    <TranslationProvider>
      <ProceedInChatDialog productId={GATED_PRODUCT_ID} open={open} onOpenChange={vi.fn()} />
    </TranslationProvider>,
  );

describe('ProceedInChatDialog', () => {
  it('renders nothing when closed', () => {
    const { container } = renderDialog(false);
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('shows the product name and dotNS domain when open', () => {
    renderDialog();

    expect(screen.getByText('Coin Flip')).toBeInTheDocument();
    expect(screen.getByText(GATED_PRODUCT_ID)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /proceed in chat/i })).toBeInTheDocument();
  });

  it('calls the mutation, closes the dialog, and shows a toast on success', async () => {
    const onOpenChange = vi.fn();
    runMock.mockReturnValueOnce(of({ room: { sessionId: '0xsession' }, status: 'New' }));
    render(
      <TranslationProvider>
        <ProceedInChatDialog productId={GATED_PRODUCT_ID} open onOpenChange={onOpenChange} />
      </TranslationProvider>,
    );

    await userEvent.click(screen.getByTestId('proceed-in-chat-dialog-confirm-button'));

    expect(runMock).toHaveBeenCalledWith(
      expect.objectContaining({
        productId: GATED_PRODUCT_ID,
        userId: '0xuser',
        roomId: 'coin-flip',
      }),
    );
    expect(toastWithAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: expect.objectContaining({ label: 'Open chat' }),
      }),
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('shows a toast error and keeps the dialog open when the mutation stream errors', async () => {
    runMock.mockReturnValueOnce(throwError(() => new Error('boom')));
    renderDialog();

    await userEvent.click(screen.getByTestId('proceed-in-chat-dialog-confirm-button'));

    expect(toastError).toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: /proceed in chat/i })).toBeInTheDocument();
  });
});
