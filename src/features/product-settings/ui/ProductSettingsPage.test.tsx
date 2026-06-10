// @vitest-environment happy-dom

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type PropsWithChildren, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { forgetProductMock, useDisplayedProductMock } = vi.hoisted(() => ({
  forgetProductMock: vi.fn(),
  useDisplayedProductMock: vi.fn(() => ({ data: null, pending: false, error: null })),
}));

vi.mock('@novasamatech/tr-ui', () => {
  const Dialog = ({ open, children }: PropsWithChildren<{ open: boolean }>) => (open ? <div>{children}</div> : null);
  Dialog.Content = ({ children }: PropsWithChildren<{ showCloseButton?: boolean }>) => <div>{children}</div>;
  Dialog.Header = ({ children }: PropsWithChildren) => <div>{children}</div>;
  Dialog.Footer = ({ children }: PropsWithChildren) => <div>{children}</div>;
  Dialog.Title = ({ children }: PropsWithChildren) => <div>{children}</div>;
  Dialog.Description = ({ children }: PropsWithChildren) => <div>{children}</div>;
  Dialog.Close = ({ children }: PropsWithChildren<{ asChild?: boolean }>) => <div>{children}</div>;

  return {
    Dialog,
    Button: ({ children, onClick }: PropsWithChildren<{ onClick?: VoidFunction }>) => (
      <button onClick={onClick}>{children}</button>
    ),
    ScrollArea: ({ children }: PropsWithChildren) => <div>{children}</div>,
    toastSuccess: vi.fn(),
  };
});

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('@/domains/product', () => ({
  useDisplayedProduct: useDisplayedProductMock,
  useProductPermissions: () => ({ data: null }),
  useAllAliasPermissions: () => ({ data: [] }),
  lifecycleUseCase: { clearProductCache: vi.fn() },
  permissionsService: {},
  productService: { refreshTargetIdentifiers: () => new Set() },
}));

vi.mock('@/aggregates/product-loading', () => ({
  onProductRefreshRequestedSideEffect: { apply: vi.fn() },
}));

vi.mock('@/aggregates/product-management', () => ({
  useForgetProduct: () => ({ forgetProduct: forgetProductMock }),
}));

vi.mock('@/widgets/Permission', () => ({
  STATUS_LABEL_KEYS: {},
  getPermissionMeta: () => undefined,
}));

vi.mock('@/widgets/ProductIcon', () => ({
  ProductIcon: ({ fallback }: { fallback: ReactNode }) => <div>{fallback}</div>,
}));

import { TranslationProvider } from '@/shared/translation';

import { ProductSettingsPage } from './ProductSettingsPage';

const renderPage = (productId: string) =>
  render(
    <TranslationProvider>
      <ProductSettingsPage productId={productId} backLabel="Back" onBack={vi.fn()} />
    </TranslationProvider>,
  );

describe('ProductSettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useDisplayedProductMock.mockReturnValue({ data: null, pending: false, error: null });
  });

  it('forgets a permission-only product even when it cannot be resolved', async () => {
    const user = userEvent.setup();
    renderPage('localhost:5173');

    // Page-level button opens the dialog; the second 'Forget App' is the confirm.
    await user.click(screen.getByText('Forget App'));
    const confirm = screen.getAllByText('Forget App')[1]!;
    await user.click(confirm);

    expect(forgetProductMock).toHaveBeenCalledWith('localhost:5173');
  });
});
