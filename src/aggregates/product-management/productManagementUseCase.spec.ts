import { beforeEach, describe, expect, it, vi } from 'vitest';

import { cardsUseCase, foldersUseCase } from '@/domains/application';
import { type Product, commitmentUseCase, lifecycleUseCase } from '@/domains/product';
import { truapiRuntimeUseCase } from '@/aggregates/truapi-runtime';

import { productManagementUseCase } from './productManagementUseCase';

// The aggregate composes domain use cases, all plain objects: each method it reaches is
// spied in place, so the orchestration is the only real code on the path.
vi.spyOn(cardsUseCase, 'addCardToLayout');
vi.spyOn(cardsUseCase, 'resizeCardToGridSize');
vi.spyOn(cardsUseCase, 'removeCardFromLayout');
vi.spyOn(cardsUseCase, 'seedDefaultMainLayout');
vi.spyOn(foldersUseCase, 'addToFavorites');
vi.spyOn(foldersUseCase, 'removeItemFromFolder');
vi.spyOn(commitmentUseCase, 'commitResolvedProduct');
vi.spyOn(commitmentUseCase, 'commitProductByIdentifier');
vi.spyOn(lifecycleUseCase, 'purgeProduct');
vi.spyOn(lifecycleUseCase, 'listCoreProductIds');
vi.spyOn(lifecycleUseCase, 'clearProductCache');
vi.spyOn(truapiRuntimeUseCase, 'clearProductState');

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
  vi.mocked(cardsUseCase.addCardToLayout).mockResolvedValue({ ok: true });
  vi.mocked(cardsUseCase.resizeCardToGridSize).mockResolvedValue({ ok: true });
  vi.mocked(foldersUseCase.addToFavorites).mockResolvedValue({ ok: true });
  vi.mocked(foldersUseCase.removeItemFromFolder).mockResolvedValue(true);
  vi.mocked(cardsUseCase.removeCardFromLayout).mockResolvedValue(true);
  vi.mocked(lifecycleUseCase.purgeProduct).mockResolvedValue(true);
  vi.mocked(lifecycleUseCase.listCoreProductIds).mockResolvedValue(['app.dot']);
  vi.mocked(lifecycleUseCase.clearProductCache).mockResolvedValue();
  vi.mocked(truapiRuntimeUseCase.clearProductState).mockResolvedValue();
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
  it('commits the product, then adds it as a product:widget card', async () => {
    vi.mocked(cardsUseCase.addCardToLayout).mockResolvedValue({ ok: true, pageIndex: 2 });

    const result = await productManagementUseCase.addProductToDashboard(product, { w: 1, h: 4 });

    expect(commitmentUseCase.commitResolvedProduct).toHaveBeenCalledWith(product);
    expect(cardsUseCase.addCardToLayout).toHaveBeenCalledWith(
      expect.objectContaining({ i: 'app.dot', w: 1, h: 4, payload: { kind: 'product:widget', productId: 'app.dot' } }),
    );
    expect(cardsUseCase.resizeCardToGridSize).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: true, pageIndex: 2 });
  });

  it('adds a 1×1 to favorites (never resizes)', async () => {
    vi.mocked(foldersUseCase.addToFavorites).mockResolvedValue({ ok: true, pageIndex: 0 });

    const result = await productManagementUseCase.addProductToDashboard(product, { w: 1, h: 1 });

    expect(foldersUseCase.addToFavorites).toHaveBeenCalledWith('app.dot');
    expect(cardsUseCase.resizeCardToGridSize).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: true, pageIndex: 0 });
  });

  it('falls back to resize when the widget is already on a page', async () => {
    vi.mocked(cardsUseCase.addCardToLayout).mockResolvedValue({ ok: false });
    vi.mocked(cardsUseCase.resizeCardToGridSize).mockResolvedValue({ ok: true, pageIndex: 0 });

    const result = await productManagementUseCase.addProductToDashboard(product, { w: 2, h: 4 });

    expect(cardsUseCase.resizeCardToGridSize).toHaveBeenCalledWith('app.dot', { w: 2, h: 4 });
    expect(result).toEqual({ ok: true, pageIndex: 0 });
  });

  it('returns ok:false and skips placement when the commit fails', async () => {
    vi.mocked(commitmentUseCase.commitResolvedProduct).mockResolvedValue(null);

    const result = await productManagementUseCase.addProductToDashboard(product, { w: 1, h: 4 });

    expect(result).toEqual({ ok: false });
    expect(cardsUseCase.addCardToLayout).not.toHaveBeenCalled();
  });
});

describe('forgetProduct', () => {
  it('skips removeCardFromLayout when removeItemFromFolder succeeded, then purges', async () => {
    vi.mocked(foldersUseCase.removeItemFromFolder).mockResolvedValue(true);

    const result = await productManagementUseCase.forgetProduct('app.dot');

    expect(cardsUseCase.removeCardFromLayout).not.toHaveBeenCalled();
    expect(lifecycleUseCase.purgeProduct).toHaveBeenCalledWith('app.dot');
    expect(result).toBe(true);
  });

  it('falls back to removeCardFromLayout when removeItemFromFolder returned false', async () => {
    vi.mocked(foldersUseCase.removeItemFromFolder).mockResolvedValue(false);

    await productManagementUseCase.forgetProduct('app.dot');

    expect(cardsUseCase.removeCardFromLayout).toHaveBeenCalledWith('app.dot');
    expect(lifecycleUseCase.purgeProduct).toHaveBeenCalledWith('app.dot');
  });

  it('returns the purge result', async () => {
    vi.mocked(lifecycleUseCase.purgeProduct).mockResolvedValue(false);

    const result = await productManagementUseCase.forgetProduct('app.dot');

    expect(result).toBe(false);
  });

  it('has the core clear its state under every id the product is filed under', async () => {
    vi.mocked(lifecycleUseCase.listCoreProductIds).mockResolvedValue(['app.dot', 'App.dot']);

    await productManagementUseCase.forgetProduct('app.dot');

    expect(lifecycleUseCase.listCoreProductIds).toHaveBeenCalledWith('app.dot');
    expect(truapiRuntimeUseCase.clearProductState).toHaveBeenCalledWith('app.dot');
    expect(truapiRuntimeUseCase.clearProductState).toHaveBeenCalledWith('App.dot');
  });

  it('still purges when the core refuses to clear one id', async () => {
    vi.mocked(lifecycleUseCase.listCoreProductIds).mockResolvedValue(['app.dot', 'App.dot']);
    vi.mocked(truapiRuntimeUseCase.clearProductState).mockRejectedValueOnce(new Error('disposed'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(productManagementUseCase.forgetProduct('app.dot')).resolves.toBe(true);
    expect(truapiRuntimeUseCase.clearProductState).toHaveBeenCalledTimes(2);
    expect(lifecycleUseCase.purgeProduct).toHaveBeenCalledWith('app.dot');
    warn.mockRestore();
  });
});

describe('clearProductData', () => {
  it('clears the core state and the sandbox data, keeping the product', async () => {
    await productManagementUseCase.clearProductData('app.dot');

    expect(truapiRuntimeUseCase.clearProductState).toHaveBeenCalledWith('app.dot');
    expect(lifecycleUseCase.clearProductCache).toHaveBeenCalledWith('app.dot');
    expect(lifecycleUseCase.purgeProduct).not.toHaveBeenCalled();
  });
});
