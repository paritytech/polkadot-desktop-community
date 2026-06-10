// @vitest-environment happy-dom

import { render, screen } from '@testing-library/react';
import { type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

const { useProductsMock, useDisplayedProductMock } = vi.hoisted(() => ({
  useProductsMock: vi.fn(),
  useDisplayedProductMock: vi.fn(),
}));

vi.mock('@/domains/product', () => ({
  useProducts: () => useProductsMock(),
  useDisplayedProduct: () => useDisplayedProductMock(),
  dotNsService: { toDisplayName: (name: string) => name.replace(/\.dot$/, '') },
}));

// Mocked so the test asserts on the `icon` prop the tab passes, not on async
// IPFS byte resolution: the real bug is the tab passing no icon at all.
vi.mock('@/widgets/ProductIcon', () => ({
  ProductIcon: ({ icon, fallback }: { icon?: { cid: string } | null; fallback: ReactNode }) =>
    icon ? <span data-testid="product-icon">{icon.cid}</span> : <span data-testid="icon-fallback">{fallback}</span>,
}));

// ProductTabContent only consumes TabChip + tabIconClassName from the barrel,
// so a full replacement keeps the test isolated from the rest of @/shared/components.
vi.mock('@/shared/components', () => ({
  tabIconClassName: '',
  TabChip: ({ icon, label }: { icon: ReactNode; label: string }) => (
    <div>
      {icon}
      <span data-testid="label">{label}</span>
    </div>
  ),
}));

import { ProductTabContent } from './ProductTabContent';

describe('ProductTabContent', () => {
  it('renders the resolved icon and name for a tab whose product is not installed', () => {
    // Not in the committed/installed list…
    useProductsMock.mockReturnValue({ data: [] });
    // …but resolvable live, exactly like the AddressBar shows it.
    useDisplayedProductMock.mockReturnValue({
      data: {
        baseName: 'coinflip.dot',
        displayName: 'Coin Flip',
        icon: { cid: 'bafyicon', format: 'png' },
        executables: {},
      },
      pending: false,
      error: null,
    });

    render(<ProductTabContent id="coinflip.dot" isActive={false} setDeeplink={vi.fn()} />);

    expect(screen.getByTestId('product-icon').textContent).toBe('bafyicon');
    expect(screen.getByTestId('label').textContent).toBe('Coin Flip');
  });
});
