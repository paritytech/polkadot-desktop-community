// @vitest-environment happy-dom

import { fireEvent, render, screen } from '@testing-library/react';
import { type ComponentProps } from 'react';
import { IntlProvider, ReactIntlErrorCode } from 'react-intl';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Empty test catalog: ignore the expected missing-translation noise (formatjs#619), keep real errors.
const onIntlError: ComponentProps<typeof IntlProvider>['onError'] = err => {
  if (err.code !== ReactIntlErrorCode.MISSING_TRANSLATION) console.error(err);
};

const seedFavorites = (ids: string[]) => {
  mainDashboardLayoutResource.instead(() =>
    of({
      pages: [[{ i: FAVORITES_FOLDER_ID, x: 0, y: 0, w: 1, h: 1, payload: { kind: 'folder' as const, items: ids } }]],
      activePageIndex: 0,
    }),
  );

  const records = ids.map(id => ({
    baseName: id,
    displayName: id,
    description: '',
    icon: { cid: '', format: 'png' },
    executables: {},
    pinned: false,
    createdAt: 1000,
    updatedAt: 1000,
  })) as unknown as PersistedProduct[];

  productsResource.instead(() => of(records));
};

import { FAVORITES_FOLDER_ID, foldersUseCase, mainDashboardLayoutResource } from '@/domains/application';
import { type PersistedProduct, productsResource } from '@/domains/product';
import { openFavoriteItemSideEffect } from '@/features/dashboard';
import { addToFavoritesDialogOpen } from '../state/addToFavoritesDialog';

import { FavoritesFullscreen } from './FavoritesFullscreen';

// The folder write is a use-case method on a plain object, spied in place: the hook is a
// `useAction` wrapper over it, so the real hook runs and the spy sees the item id.
const removeItemFromFolder = vi.spyOn(foldersUseCase, 'removeItemFromFolder').mockResolvedValue(true);

const renderPage = () =>
  render(
    <IntlProvider locale="en" messages={{}} onError={onIntlError}>
      <FavoritesFullscreen />
    </IntlProvider>,
  );

// The open is a DI side effect, so the test registers a handler on it rather than
// standing in for the module that declares it.
const openFavoriteItem = vi.fn();

describe('FavoritesFullscreen', () => {
  beforeEach(() => {
    removeItemFromFolder.mockClear();
    openFavoriteItem.mockClear();
    openFavoriteItemSideEffect.registerHandler({ available: () => true, body: openFavoriteItem });
    seedFavorites(['coinflip', 'staking']);
  });

  afterEach(() => {
    openFavoriteItemSideEffect.resetHandlers();
  });

  it('renders a card per favorite product', async () => {
    renderPage();
    expect(await screen.findByText('coinflip')).toBeInTheDocument();
    expect(screen.getByText('staking')).toBeInTheDocument();
  });

  it('opens a product via the side-effect', () => {
    renderPage();
    screen.getByRole('button', { name: 'coinflip' }).click();
    expect(openFavoriteItem).toHaveBeenCalledWith({ itemId: 'coinflip' });
  });

  it('removes a product from favorites', () => {
    renderPage();
    screen.getAllByTestId('favorites-card-remove')[0]!.click();
    expect(removeItemFromFolder).toHaveBeenCalledWith('coinflip');
  });

  it('filters the grid by the search query', () => {
    renderPage();
    const input = screen.getByTestId('favorites-search-input');
    expect(input).not.toBeNull();
    fireEvent.change(input, { target: { value: 'stak' } });
    expect(screen.queryByText('coinflip')).not.toBeInTheDocument();
    expect(screen.getByText('staking')).toBeInTheDocument();
  });

  it('shows the "no results" state when the search matches no favorite', () => {
    renderPage();
    const input = screen.getByTestId('favorites-search-input');
    fireEvent.change(input, { target: { value: 'zzz' } });
    expect(screen.getByTestId('favorites-search-no-results')).toBeInTheDocument();
  });

  it('shows the empty state and opens the add dialog via "Browse Apps"', async () => {
    seedFavorites([]);
    renderPage();
    expect(await screen.findByTestId('favorites-empty-state')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('favorites-browse-apps'));
    expect(addToFavoritesDialogOpen.get()).toBe(true);
  });

  it('opens the add dialog via the header "+" button', () => {
    renderPage();
    fireEvent.click(screen.getByTestId('favorites-add-button'));
    expect(addToFavoritesDialogOpen.get()).toBe(true);
  });
});
