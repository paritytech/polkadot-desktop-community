import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/domains/application', () => ({
  DEFAULT_DASHBOARD_WIDGET_PRODUCT_ID: 'browse.dot',
  cardsUseCase: {
    addWidgetToLayout: vi.fn(),
    resizeCardToGridSize: vi.fn(),
    removeCardFromLayout: vi.fn(),
    seedDefaultMainLayout: vi.fn(),
  },
  foldersUseCase: {
    addIconToFavorites: vi.fn(),
    removeIconFromFolder: vi.fn(),
  },
}));

vi.mock('@/domains/product', () => ({
  commitmentUseCase: {
    commitResolvedProduct: vi.fn(),
    commitProductByIdentifier: vi.fn(),
  },
  lifecycleUseCase: {
    purgeProduct: vi.fn(),
  },
}));

import { cardsUseCase, foldersUseCase } from '@/domains/application';
import { type Product, commitmentUseCase, lifecycleUseCase } from '@/domains/product';

import { productManagementUseCase } from './productManagementUseCase';

// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
const product = { baseName: 'app.dot' } as Product;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(commitmentUseCase.commitResolvedProduct).mockResolvedValue(
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    { baseName: 'app.dot', pinned: false, createdAt: 0, updatedAt: 0 } as Awaited<
      ReturnType<typeof commitmentUseCase.commitResolvedProduct>
    >,
  );
  vi.mocked(cardsUseCase.addWidgetToLayout).mockResolvedValue({ ok: true });
  vi.mocked(cardsUseCase.resizeCardToGridSize).mockResolvedValue({ ok: true });
  vi.mocked(foldersUseCase.addIconToFavorites).mockResolvedValue({ ok: true });
  vi.mocked(foldersUseCase.removeIconFromFolder).mockResolvedValue(true);
  vi.mocked(cardsUseCase.removeCardFromLayout).mockResolvedValue(true);
  vi.mocked(lifecycleUseCase.purgeProduct).mockResolvedValue(true);
  vi.mocked(cardsUseCase.seedDefaultMainLayout).mockResolvedValue(false);
  vi.mocked(commitmentUseCase.commitProductByIdentifier).mockResolvedValue(null);
});

describe('ensureDefaultDashboard', () => {
  it('commits the default product when a fresh dashboard was seeded', async () => {
    vi.mocked(cardsUseCase.seedDefaultMainLayout).mockResolvedValue(true);

    await productManagementUseCase.ensureDefaultDashboard();

    expect(commitmentUseCase.commitProductByIdentifier).toHaveBeenCalledWith('browse.dot');
  });

  it('does nothing when a dashboard already exists (no seed)', async () => {
    vi.mocked(cardsUseCase.seedDefaultMainLayout).mockResolvedValue(false);

    await productManagementUseCase.ensureDefaultDashboard();

    expect(commitmentUseCase.commitProductByIdentifier).not.toHaveBeenCalled();
  });
});

describe('addProductToDashboard', () => {
  it('commits the product, then adds it as a widget', async () => {
    vi.mocked(cardsUseCase.addWidgetToLayout).mockResolvedValue({ ok: true, pageIndex: 2 });

    const result = await productManagementUseCase.addProductToDashboard(product, { w: 1, h: 4 });

    expect(commitmentUseCase.commitResolvedProduct).toHaveBeenCalledWith(product);
    expect(cardsUseCase.addWidgetToLayout).toHaveBeenCalledWith('app.dot', { w: 1, h: 4 }, 4);
    expect(cardsUseCase.resizeCardToGridSize).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: true, pageIndex: 2 });
  });

  it('adds a 1×1 to favorites (never resizes)', async () => {
    vi.mocked(foldersUseCase.addIconToFavorites).mockResolvedValue({ ok: true, pageIndex: 0 });

    const result = await productManagementUseCase.addProductToDashboard(product, { w: 1, h: 1 });

    expect(foldersUseCase.addIconToFavorites).toHaveBeenCalledWith('app.dot');
    expect(cardsUseCase.resizeCardToGridSize).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: true, pageIndex: 0 });
  });

  it('falls back to resize when the widget is already on a page', async () => {
    vi.mocked(cardsUseCase.addWidgetToLayout).mockResolvedValue({ ok: false });
    vi.mocked(cardsUseCase.resizeCardToGridSize).mockResolvedValue({ ok: true, pageIndex: 0 });

    const result = await productManagementUseCase.addProductToDashboard(product, { w: 2, h: 4 });

    expect(cardsUseCase.resizeCardToGridSize).toHaveBeenCalledWith('app.dot', { w: 2, h: 4 });
    expect(result).toEqual({ ok: true, pageIndex: 0 });
  });

  it('returns ok:false and skips placement when the commit fails', async () => {
    vi.mocked(commitmentUseCase.commitResolvedProduct).mockResolvedValue(null);

    const result = await productManagementUseCase.addProductToDashboard(product, { w: 1, h: 4 });

    expect(result).toEqual({ ok: false });
    expect(cardsUseCase.addWidgetToLayout).not.toHaveBeenCalled();
  });
});

describe('forgetProduct', () => {
  it('skips removeCardFromLayout when removeIconFromFolder succeeded, then purges', async () => {
    vi.mocked(foldersUseCase.removeIconFromFolder).mockResolvedValue(true);

    const result = await productManagementUseCase.forgetProduct('app.dot');

    expect(cardsUseCase.removeCardFromLayout).not.toHaveBeenCalled();
    expect(lifecycleUseCase.purgeProduct).toHaveBeenCalledWith('app.dot');
    expect(result).toBe(true);
  });

  it('falls back to removeCardFromLayout when removeIconFromFolder returned false', async () => {
    vi.mocked(foldersUseCase.removeIconFromFolder).mockResolvedValue(false);

    await productManagementUseCase.forgetProduct('app.dot');

    expect(cardsUseCase.removeCardFromLayout).toHaveBeenCalledWith('app.dot');
    expect(lifecycleUseCase.purgeProduct).toHaveBeenCalledWith('app.dot');
  });

  it('returns the purge result', async () => {
    vi.mocked(lifecycleUseCase.purgeProduct).mockResolvedValue(false);

    const result = await productManagementUseCase.forgetProduct('app.dot');

    expect(result).toBe(false);
  });
});
