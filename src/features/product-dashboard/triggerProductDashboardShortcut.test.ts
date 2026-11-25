// @vitest-environment happy-dom

import { render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Toaster } from '@/shared/components';
import { TranslationProvider } from '@/shared/translation';
import { foldersUseCase } from '@/domains/application';
import { resolveProductUseCase } from '@/domains/product';
import { productManagementUseCase } from '@/aggregates/product-management';
import { getAddToDashboardDialogTarget } from '@/features/dashboard';

import { triggerProductDashboardShortcut } from './triggerProductDashboardShortcut';

// The shortcut composes three use cases, all plain objects spied in place: no chain
// resolve, no layout write — the routing decision is the only real code on the path.
const resolveProductMock = vi.spyOn(resolveProductUseCase, 'resolveProduct');
const isIconInFavoritesMock = vi.spyOn(foldersUseCase, 'isIconInFavorites').mockResolvedValue(false);
const removeIconMock = vi.spyOn(foldersUseCase, 'removeItemFromFolder').mockResolvedValue(true);
const addProductToDashboardMock = vi.spyOn(productManagementUseCase, 'addProductToDashboard').mockResolvedValue({ ok: true });

const t = (id: string) => id;

describe('triggerProductDashboardShortcut', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isIconInFavoritesMock.mockResolvedValue(false);
    render(createElement(TranslationProvider, null, createElement(Toaster)));
  });

  it('opens the add-to-dashboard dialog for widget products', async () => {
    resolveProductMock.mockResolvedValue({ baseName: 'app.widget', displayName: 'App', executables: { widget: {} } } as never);

    await triggerProductDashboardShortcut('app.widget', t);

    expect(getAddToDashboardDialogTarget()).toBe('app.widget');
    expect(addProductToDashboardMock).not.toHaveBeenCalled();
  });

  it('adds a non-widget product to favorites when it is not already there', async () => {
    resolveProductMock.mockResolvedValue({ baseName: 'app.dot', displayName: 'App', executables: {} } as never);

    await triggerProductDashboardShortcut('app.dot', t);

    expect(isIconInFavoritesMock).toHaveBeenCalledWith('app.dot');
    expect(addProductToDashboardMock).toHaveBeenCalledWith(expect.objectContaining({ baseName: 'app.dot' }), { w: 1, h: 1 });
    await screen.findByText('feature.dashboard.menu.toast.addedToFavorites');
  });

  it('removes a non-widget product from favorites when it is already there', async () => {
    resolveProductMock.mockResolvedValue({ baseName: 'app.dot', displayName: 'App', executables: {} } as never);
    isIconInFavoritesMock.mockResolvedValue(true);

    await triggerProductDashboardShortcut('app.dot', t);

    expect(removeIconMock).toHaveBeenCalledWith('app.dot');
    expect(addProductToDashboardMock).not.toHaveBeenCalled();
    await screen.findByText('feature.dashboard.menu.toast.removedFromFavorites');
  });

  it('keeps the favorites path for a resolved product even when its id is a native addable id', async () => {
    resolveProductMock.mockResolvedValue({ baseName: 'chat', displayName: 'Chat App', executables: {} } as never);

    await triggerProductDashboardShortcut('chat', t);

    expect(resolveProductMock).toHaveBeenCalledWith('chat');
    expect(getAddToDashboardDialogTarget()).toBeNull();
    expect(addProductToDashboardMock).toHaveBeenCalledWith(expect.objectContaining({ baseName: 'chat' }), { w: 1, h: 1 });
  });

  it('does nothing for an unknown id that does not resolve to a product', async () => {
    resolveProductMock.mockResolvedValue(null);

    await triggerProductDashboardShortcut('unknown', t);

    expect(getAddToDashboardDialogTarget()).toBeNull();
    expect(addProductToDashboardMock).not.toHaveBeenCalled();
  });
});
