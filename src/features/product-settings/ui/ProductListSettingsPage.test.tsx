// @vitest-environment happy-dom

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { useInteractedProductsMock, useDisplayedProductMock } = vi.hoisted(() => ({
  useInteractedProductsMock: vi.fn(() => ({ data: [] as { kind: 'permissionOnly'; productId: string }[] })),
  useDisplayedProductMock: vi.fn(() => ({ data: null, pending: false, error: null })),
}));

vi.mock('@novasamatech/tr-ui', async importOriginal => ({
  ...(await importOriginal<object>()),
  Input: (props: object) => <input {...props} />,
}));

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('@/domains/product', () => ({
  useInteractedProducts: useInteractedProductsMock,
  useDisplayedProduct: useDisplayedProductMock,
  isLocalhostUrl: (url: string) => url.startsWith('http://localhost') || url.startsWith('localhost'),
  productService: { matchesQuery: () => true },
}));

vi.mock('@/widgets/ProductIcon', () => ({
  ProductIcon: () => <div />,
}));

import { TranslationProvider } from '@/shared/translation';

import { ProductListSettingsPage } from './ProductListSettingsPage';

const renderPage = () =>
  render(
    <TranslationProvider>
      <ProductListSettingsPage />
    </TranslationProvider>,
  );

describe('ProductListSettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useDisplayedProductMock.mockReturnValue({ data: null, pending: false, error: null });
  });

  it('renders a permission-only row with the raw id as fallback label', () => {
    useInteractedProductsMock.mockReturnValue({ data: [{ kind: 'permissionOnly', productId: 'browsed.dot' }] });

    renderPage();

    expect(useDisplayedProductMock).toHaveBeenCalledWith('browsed.dot');
    expect(screen.getAllByText('browsed.dot').length).toBeGreaterThan(0);
  });

  it('does not chain-resolve localhost permission-only entries', () => {
    useInteractedProductsMock.mockReturnValue({ data: [{ kind: 'permissionOnly', productId: 'localhost:5173' }] });

    renderPage();

    expect(useDisplayedProductMock).toHaveBeenCalledWith(null);
    expect(screen.getAllByText('localhost:5173').length).toBeGreaterThan(0);
  });
});
