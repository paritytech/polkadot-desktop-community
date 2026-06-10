import { beforeEach, describe, expect, it, vi } from 'vitest';

const { resolveProductMock, openDialogMock, isIconInFavoritesMock, removeIconMock, addProductToDashboardMock, toastSuccessMock } =
  vi.hoisted(() => ({
    resolveProductMock: vi.fn(),
    openDialogMock: vi.fn(),
    isIconInFavoritesMock: vi.fn(() => Promise.resolve(false)),
    removeIconMock: vi.fn(() => Promise.resolve(true)),
    addProductToDashboardMock: vi.fn(() => Promise.resolve({ ok: true })),
    toastSuccessMock: vi.fn(),
  }));

vi.mock('@novasamatech/tr-ui', () => ({
  toastSuccess: (args: unknown) => toastSuccessMock(args),
}));

vi.mock('@/domains/product', () => ({
  resolveProductUseCase: { resolveProduct: resolveProductMock },
  productService: {
    hasWidget: (product: { baseName: string }) => product.baseName.endsWith('.widget'),
  },
}));

vi.mock('@/aggregates/product-management', () => ({
  productManagementUseCase: { addProductToDashboard: addProductToDashboardMock },
}));

vi.mock('@/domains/application', () => ({
  foldersUseCase: {
    isIconInFavorites: isIconInFavoritesMock,
    removeIconFromFolder: removeIconMock,
  },
}));

vi.mock('./state/addToDashboardDialog', () => ({
  openAddToDashboardDialog: openDialogMock,
}));

import { triggerProductDashboardShortcut } from './triggerProductDashboardShortcut';

const t = (id: string) => id;

describe('triggerProductDashboardShortcut', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isIconInFavoritesMock.mockResolvedValue(false);
  });

  it('opens the add-to-dashboard dialog for widget products', async () => {
    resolveProductMock.mockResolvedValue({ baseName: 'app.widget', displayName: 'App' });

    await triggerProductDashboardShortcut('app.widget', t);

    expect(openDialogMock).toHaveBeenCalledWith('app.widget');
    expect(addProductToDashboardMock).not.toHaveBeenCalled();
  });

  it('adds a non-widget product to favorites when it is not already there', async () => {
    resolveProductMock.mockResolvedValue({ baseName: 'app.dot', displayName: 'App' });

    await triggerProductDashboardShortcut('app.dot', t);

    expect(isIconInFavoritesMock).toHaveBeenCalledWith('app.dot');
    expect(addProductToDashboardMock).toHaveBeenCalledWith(expect.objectContaining({ baseName: 'app.dot' }), { w: 1, h: 1 });
    expect(toastSuccessMock).toHaveBeenCalled();
  });

  it('removes a non-widget product from favorites when it is already there', async () => {
    resolveProductMock.mockResolvedValue({ baseName: 'app.dot', displayName: 'App' });
    isIconInFavoritesMock.mockResolvedValue(true);

    await triggerProductDashboardShortcut('app.dot', t);

    expect(removeIconMock).toHaveBeenCalledWith('app.dot');
    expect(addProductToDashboardMock).not.toHaveBeenCalled();
    expect(toastSuccessMock).toHaveBeenCalled();
  });
});
