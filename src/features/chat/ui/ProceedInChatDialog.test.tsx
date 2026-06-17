// @vitest-environment happy-dom

import { toastError, toastSuccess } from '@novasamatech/tr-ui';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TranslationProvider } from '@/shared/translation';

import { ProceedInChatDialog } from './ProceedInChatDialog';

vi.mock('@novasamatech/tr-ui', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@novasamatech/tr-ui');
  return {
    ...actual,
    toastError: vi.fn(),
    toastSuccess: vi.fn(),
  };
});

const navigateMock = vi.fn();
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateMock,
}));

const addTabMock = vi.fn();
const selectTabMock = vi.fn();
vi.mock('@/aggregates/browser-tabs', () => ({
  browserTabs: {
    addTab: (...args: unknown[]) => addTabMock(...args),
    selectTab: (...args: unknown[]) => selectTabMock(...args),
  },
}));

const runMock = vi.fn();
vi.mock('@/domains/chat', () => ({
  useCreateProductRoom: () => ({ run: runMock, pending: false, status: null }),
  useCurrentUserPeer: () => ({
    data: { type: 'user', accountId: '0xuser' as const, name: 'U' },
    pending: false,
  }),
  useProductRooms: () => ({ data: [], pending: false, error: null }),
  useDeclaredProductRooms: () => ({
    data: [{ productId: 'my-app.dot', roomId: 'my-app' }],
    pending: false,
    error: null,
  }),
  productChatService: {
    getSessionId: () => '0xsession',
  },
}));

vi.mock('@/domains/product', () => ({
  useDisplayedProduct: (productId: string) => ({
    data: {
      baseName: productId,
      displayName: 'My App',
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

const GATED_PRODUCT_ID = 'my-app.dot';

const renderDialog = (open = true) =>
  render(
    <TranslationProvider>
      <ProceedInChatDialog productId={GATED_PRODUCT_ID} open={open} onOpenChange={vi.fn()} />
    </TranslationProvider>,
  );

describe('ProceedInChatDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when closed', () => {
    const { container } = renderDialog(false);
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('shows the product name and dotNS domain when open', () => {
    renderDialog();

    expect(screen.getByText('My App')).toBeInTheDocument();
    expect(screen.getByText(GATED_PRODUCT_ID)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /proceed in chat/i })).toBeInTheDocument();
  });

  it('calls the mutation, shows a success toast, closes the dialog, and navigates on new room creation', async () => {
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
        roomId: 'my-app',
      }),
    );
    expect(toastSuccess).toHaveBeenCalledWith({
      title: 'The My App product room has been successfully created in the chat',
    });
    expect(addTabMock).toHaveBeenCalled();
    expect(selectTabMock).toHaveBeenCalledWith('chat');
    expect(navigateMock).toHaveBeenCalledWith({
      to: '/chat/{-$chatId}',
      params: { chatId: '0xsession' },
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('navigates without a success toast when the room already exists', async () => {
    runMock.mockReturnValueOnce(of({ room: { sessionId: '0xsession' }, status: 'Exists' }));
    renderDialog();

    await userEvent.click(screen.getByTestId('proceed-in-chat-dialog-confirm-button'));

    expect(toastSuccess).not.toHaveBeenCalled();
    expect(navigateMock).toHaveBeenCalledWith({
      to: '/chat/{-$chatId}',
      params: { chatId: '0xsession' },
    });
  });

  it('shows a toast error and keeps the dialog open when the mutation stream errors', async () => {
    runMock.mockReturnValueOnce(throwError(() => new Error('boom')));
    renderDialog();

    await userEvent.click(screen.getByTestId('proceed-in-chat-dialog-confirm-button'));

    expect(toastError).toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: /proceed in chat/i })).toBeInTheDocument();
  });
});
