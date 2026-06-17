// @vitest-environment happy-dom

import { render, screen } from '@testing-library/react';
import { type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

const { useDisplayedProductMock, useProductIconMock } = vi.hoisted(() => ({
  useDisplayedProductMock: vi.fn(),
  useProductIconMock: vi.fn(),
}));

vi.mock('@/domains/product', () => ({
  useDisplayedProduct: () => useDisplayedProductMock(),
  useProductIcon: () => useProductIconMock(),
  dotNsService: { toDisplayName: (name: string) => name.replace(/\.dot$/, '') },
}));

// ProductTabContent only consumes TabChip + tabIconClassName from the barrel,
// so a full replacement keeps the test isolated from the rest of @/shared/components.
vi.mock('@/shared/components', () => ({
  tabIconClassName: '',
  TabChip: ({ icon, placeholder, label }: { icon?: ReactNode; placeholder?: ReactNode; label: string }) => (
    <div>
      {icon}
      {placeholder}
      <span data-testid="label">{label}</span>
    </div>
  ),
}));

import { ProductTabContent } from './ProductTabContent';

const MY_APP = {
  baseName: 'my-app.dot',
  displayName: 'My App',
  icon: { cid: 'bafyicon', format: 'png' },
  executables: {},
};

describe('ProductTabContent', () => {
  it('renders the resolved icon and name for a tab whose product is not installed', () => {
    // Resolvable live, exactly like the AddressBar shows it.
    useDisplayedProductMock.mockReturnValue({ data: MY_APP, pending: false, error: null });
    useProductIconMock.mockReturnValue({ data: 'data:image/png;base64,AAAA', pending: false, error: null });

    const { container } = render(<ProductTabContent id="my-app.dot" isActive={false} setDeeplink={vi.fn()} />);

    expect(container.querySelector('img')?.getAttribute('src')).toBe('data:image/png;base64,AAAA');
    expect(screen.getByTestId('label').textContent).toBe('My App');
  });

  it('renders no <img> when the product icon does not resolve', () => {
    useDisplayedProductMock.mockReturnValue({ data: MY_APP, pending: false, error: null });
    useProductIconMock.mockReturnValue({ data: null, pending: false, error: null });

    const { container } = render(<ProductTabContent id="my-app.dot" isActive={false} setDeeplink={vi.fn()} />);

    // No real icon: the placeholder is handed to TabChip but only surfaces in the
    // collapsed icon-only state, so the visible tab is the label alone.
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByTestId('label').textContent).toBe('My App');
  });
});
