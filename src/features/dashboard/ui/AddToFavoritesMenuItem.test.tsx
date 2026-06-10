// @vitest-environment happy-dom

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { triggerProductDashboardShortcutMock, favoriteProductIdsMock } = vi.hoisted(() => ({
  triggerProductDashboardShortcutMock: vi.fn<
    (productId: string, t: (id: string, values?: Record<string, string | number>) => string) => Promise<void>
  >(() => Promise.resolve()),
  favoriteProductIdsMock: vi.fn<() => ReadonlySet<string>>(() => new Set()),
}));

vi.mock('@/domains/application', () => ({
  useFavoriteProductIds: () => ({ data: favoriteProductIdsMock() }),
}));

vi.mock('../triggerProductDashboardShortcut', () => ({
  triggerProductDashboardShortcut: (productId: string, t: (id: string) => string) =>
    triggerProductDashboardShortcutMock(productId, t),
}));

vi.mock('@/features/product-actions-menu', () => ({
  MenuItem: ({ label, onSelect }: { label: ReactNode; onSelect: () => void }) => <button onClick={onSelect}>{label}</button>,
}));

import { TranslationProvider } from '@/shared/translation';
import { type Product } from '@/domains/product';

import { AddToFavoritesMenuItem } from './AddToFavoritesMenuItem';

// Minimal Product stand-in — the component only reads baseName / displayName.
const makeProduct = (baseName: string) => ({ baseName, displayName: 'My App' }) as unknown as Product;

const renderItem = (baseName: string) =>
  render(
    <TranslationProvider>
      <AddToFavoritesMenuItem product={makeProduct(baseName)} closeMenu={vi.fn()} />
    </TranslationProvider>,
  );

describe('AddToFavoritesMenuItem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    favoriteProductIdsMock.mockReturnValue(new Set());
  });

  it('delegates add/remove to the shared dashboard shortcut handler', async () => {
    const user = userEvent.setup();
    renderItem('app.dot');

    await user.click(screen.getByText('Add to Favorites'));

    await waitFor(() => expect(triggerProductDashboardShortcutMock).toHaveBeenCalledWith('app.dot', expect.any(Function)));
  });

  it('delegates remove to the shared dashboard shortcut handler when already a favorite', async () => {
    favoriteProductIdsMock.mockReturnValue(new Set(['app.dot']));
    const user = userEvent.setup();
    renderItem('app.dot');

    await user.click(screen.getByText('Remove from Favorites'));

    await waitFor(() => expect(triggerProductDashboardShortcutMock).toHaveBeenCalledWith('app.dot', expect.any(Function)));
  });
});
