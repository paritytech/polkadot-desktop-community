// @vitest-environment happy-dom

import { render, screen, waitFor } from '@testing-library/react';
import { type PropsWithChildren } from 'react';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DropdownMenu } from '@/shared/components';
import { TranslationProvider } from '@/shared/translation';
import { type PersistedProduct, productsResource } from '@/domains/product';

import { ProductDashboardMenuItem } from './ProductDashboardMenuItem';

const closeMenu = vi.fn();

// The item is a Radix `DropdownMenu.Item`, which only renders inside an open menu; a
// real one is mounted around it so the item's own selection handling is what runs.
const MenuHost = ({ children }: PropsWithChildren) => (
  <DropdownMenu.Root open>
    <DropdownMenu.Trigger asChild>
      <button type="button">menu</button>
    </DropdownMenu.Trigger>
    <DropdownMenu.Content>{children}</DropdownMenu.Content>
  </DropdownMenu.Root>
);

// Both children are real: they render a Radix `DropdownMenu.Item` and read translations,
// so the subject mounts inside an open menu and the i18n provider.
const renderItem = (productId: string) =>
  render(
    <TranslationProvider>
      <MenuHost>
        <ProductDashboardMenuItem productId={productId} closeMenu={closeMenu} />
      </MenuHost>
    </TranslationProvider>,
  );

function makeRecord(overrides: Partial<PersistedProduct> = {}): PersistedProduct {
  return {
    baseName: 'a.dot',
    displayName: 'A',
    description: '',
    icon: { cid: 'abc', format: 'png' },
    executables: {},
    pinned: false,
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides,
  };
}

// The real `useDisplayedProduct` reads through `productsResource`, so a case
// states its rows there rather than stubbing the hook. That keeps the real
// `productService.hasWidget` in the assertion path instead of a reimplementation.
describe('ProductDashboardMenuItem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders no item until the product is loaded', async () => {
    renderItem('a.dot');

    // The menu itself is mounted; the assertion is that no item ever appears.
    await waitFor(() => expect(screen.getByRole('menu')).toBeInTheDocument());
    expect(screen.queryByRole('menuitem')).toBeNull();
  });

  it('shows Add to Dashboard when the manifest defines a widget', async () => {
    productsResource.instead(() => of([makeRecord({ executables: { widget: {} as never } })]));

    renderItem('a.dot');

    expect(await screen.findByRole('menuitem', { name: 'Add to dashboard' })).toBeInTheDocument();
  });

  it('shows Add to Favorites when the manifest has no widget', async () => {
    productsResource.instead(() => of([makeRecord({ baseName: 'b.dot', displayName: 'B', executables: { app: {} as never } })]));

    renderItem('b.dot');

    expect(await screen.findByRole('menuitem', { name: 'Add to Favorites' })).toBeInTheDocument();
  });
});
