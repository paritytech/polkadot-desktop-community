// @vitest-environment happy-dom

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type PropsWithChildren } from 'react';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DropdownMenu } from '@/shared/components';
import { TranslationProvider } from '@/shared/translation';
import { FAVORITES_FOLDER_ID, foldersUseCase, mainDashboardLayoutResource } from '@/domains/application';
import { type Product, resolveProductUseCase } from '@/domains/product';
import { productManagementUseCase } from '@/aggregates/product-management';

const seedFavorites = (items: string[]) => {
  mainDashboardLayoutResource.instead(() =>
    of({
      pages: [[{ i: FAVORITES_FOLDER_ID, x: 0, y: 0, w: 1, h: 1, payload: { kind: 'folder' as const, items } }]],
      activePageIndex: 0,
    }),
  );
};

import { AddToFavoritesMenuItem } from './AddToFavoritesMenuItem';

// Minimal Product stand-in — the component reads baseName / displayName; the shortcut
// it triggers reads `executables` to decide widget vs favourite.
const makeProduct = (baseName: string) => ({ baseName, displayName: 'My App', executables: {} }) as unknown as Product;

// The shortcut composes three use cases, all plain objects spied in place: no chain
// resolve, no layout write — the toggle's routing decision is what these cases observe.
const resolveProduct = vi.spyOn(resolveProductUseCase, 'resolveProduct');
const isIconInFavorites = vi.spyOn(foldersUseCase, 'isIconInFavorites');
const removeItemFromFolder = vi.spyOn(foldersUseCase, 'removeItemFromFolder').mockResolvedValue(true);
const addProductToDashboard = vi.spyOn(productManagementUseCase, 'addProductToDashboard').mockResolvedValue({ ok: true });

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

const renderItem = (baseName: string) =>
  render(
    <TranslationProvider>
      <MenuHost>
        <AddToFavoritesMenuItem product={makeProduct(baseName)} closeMenu={vi.fn()} />
      </MenuHost>
    </TranslationProvider>,
  );

describe('AddToFavoritesMenuItem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    seedFavorites([]);
    resolveProduct.mockResolvedValue(makeProduct('app.dot'));
    isIconInFavorites.mockResolvedValue(false);
  });

  it('delegates add/remove to the shared dashboard shortcut handler', async () => {
    const user = userEvent.setup();
    renderItem('app.dot');

    await user.click(await screen.findByText('Add to Favorites'));

    await waitFor(() =>
      expect(addProductToDashboard).toHaveBeenCalledWith(expect.objectContaining({ baseName: 'app.dot' }), { w: 1, h: 1 }),
    );
    expect(removeItemFromFolder).not.toHaveBeenCalled();
  });

  it('delegates remove to the shared dashboard shortcut handler when already a favorite', async () => {
    seedFavorites(['app.dot']);
    isIconInFavorites.mockResolvedValue(true);
    const user = userEvent.setup();
    renderItem('app.dot');

    await user.click(await screen.findByText('Remove from Favorites'));

    await waitFor(() => expect(removeItemFromFolder).toHaveBeenCalledWith('app.dot'));
    expect(addProductToDashboard).not.toHaveBeenCalled();
  });
});
