// @vitest-environment happy-dom

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const { useDisplayedProductMock } = vi.hoisted(() => ({
  useDisplayedProductMock: vi.fn(),
}));

vi.mock('@/domains/product', () => ({
  useDisplayedProduct: (id: string | null) => useDisplayedProductMock(id),
  productService: {
    hasWidget: (product: { executables: { widget?: unknown } }) => product.executables.widget !== undefined,
  },
}));

vi.mock('./AddToDashboardMenuItem', () => ({
  AddToDashboardMenuItem: () => <div>add-to-dashboard</div>,
}));

vi.mock('./AddToFavoritesMenuItem', () => ({
  AddToFavoritesMenuItem: ({ product }: { product: { displayName: string } }) => (
    <div>add-to-favorites:{product.displayName}</div>
  ),
}));

import { ProductDashboardMenuItem } from './ProductDashboardMenuItem';

const closeMenu = vi.fn();

describe('ProductDashboardMenuItem', () => {
  it('renders nothing until the product is loaded', () => {
    useDisplayedProductMock.mockReturnValue({ data: null });

    const { container } = render(<ProductDashboardMenuItem productId="a.dot" closeMenu={closeMenu} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('shows Add to Dashboard when the manifest defines a widget', () => {
    useDisplayedProductMock.mockReturnValue({
      data: { baseName: 'a.dot', displayName: 'A', executables: { widget: {} } },
    });

    render(<ProductDashboardMenuItem productId="a.dot" closeMenu={closeMenu} />);

    expect(screen.getByText('add-to-dashboard')).toBeInTheDocument();
  });

  it('shows Add to Favorites when the manifest has no widget', () => {
    useDisplayedProductMock.mockReturnValue({
      data: { baseName: 'b.dot', displayName: 'B', executables: { app: {} } },
    });

    render(<ProductDashboardMenuItem productId="b.dot" closeMenu={closeMenu} />);

    expect(screen.getByText('add-to-favorites:B')).toBeInTheDocument();
  });
});
