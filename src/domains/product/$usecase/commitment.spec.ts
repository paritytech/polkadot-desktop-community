import { err, ok } from 'neverthrow';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../product/repository', () => ({
  productDb: {
    getByBaseName: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn(),
  },
}));

vi.mock('../dotns/service', () => ({
  dotNsService: {
    baseNameOf: vi.fn((id: string) => (id.endsWith('.dot') ? id : `${id}.dot`)),
  },
}));

vi.mock('./resolve', () => ({
  resolveProductUseCase: {
    fetchProductFromChain: vi.fn(),
  },
}));

vi.mock('../product/resource', () => ({
  invalidateChainResolve: vi.fn(),
}));

vi.mock('./offlineCache', () => ({
  offlineCacheUseCase: {
    prefetchArchives: vi.fn(),
    evictArchives: vi.fn(),
    reconcilePinnedArchives: vi.fn(),
  },
}));

import { productDb } from '../product/repository';
import { invalidateChainResolve } from '../product/resource';

import { commitmentUseCase } from './commitment';
import { offlineCacheUseCase } from './offlineCache';
import { resolveProductUseCase } from './resolve';

const fetchProductFromChain = resolveProductUseCase.fetchProductFromChain;

function makeProduct(overrides: Partial<{ displayName: string }> = {}) {
  return {
    baseName: 'app.dot',
    displayName: 'App',
    description: '',
    icon: { cid: 'abc', format: 'png' as const },
    executables: {},
    ...overrides,
  };
}

function makeRecord(overrides: Partial<{ pinned: boolean }> = {}) {
  return {
    ...makeProduct(),
    pinned: false,
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('commitProductByIdentifier', () => {
  it('is idempotent — returns existing row without chain call when row already exists', async () => {
    const row = makeRecord();
    vi.mocked(productDb.getByBaseName).mockReturnValue(
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions, @typescript-eslint/no-explicit-any
      Promise.resolve(ok(row)) as any,
    );

    const result = await commitmentUseCase.commitProductByIdentifier('app.dot');

    expect(result).toBe(row);
    expect(fetchProductFromChain).not.toHaveBeenCalled();
    expect(productDb.upsert).not.toHaveBeenCalled();
  });

  it('resolves chain + upserts with pinned:false + drops the chain cache when row absent', async () => {
    const fresh = makeProduct();
    const saved = makeRecord({ pinned: false });

    vi.mocked(productDb.getByBaseName).mockReturnValue(
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions, @typescript-eslint/no-explicit-any
      Promise.resolve(ok(null)) as any,
    );
    vi.mocked(fetchProductFromChain).mockResolvedValue(fresh);
    vi.mocked(productDb.upsert).mockReturnValue(
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions, @typescript-eslint/no-explicit-any
      Promise.resolve(ok(saved)) as any,
    );

    const result = await commitmentUseCase.commitProductByIdentifier('app.dot');

    expect(fetchProductFromChain).toHaveBeenCalledWith('app.dot');
    expect(productDb.upsert).toHaveBeenCalledWith(fresh, { pinned: false });
    expect(invalidateChainResolve).toHaveBeenCalledWith('app.dot');
    expect(result).toBe(saved);
  });

  it('returns null when chain returns nothing', async () => {
    vi.mocked(productDb.getByBaseName).mockReturnValue(
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions, @typescript-eslint/no-explicit-any
      Promise.resolve(ok(null)) as any,
    );
    vi.mocked(fetchProductFromChain).mockResolvedValue(null);

    const result = await commitmentUseCase.commitProductByIdentifier('app.dot');

    expect(result).toBeNull();
    expect(productDb.upsert).not.toHaveBeenCalled();
  });

  it('returns null when upsert fails', async () => {
    const fresh = makeProduct();

    vi.mocked(productDb.getByBaseName).mockReturnValue(
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions, @typescript-eslint/no-explicit-any
      Promise.resolve(ok(null)) as any,
    );
    vi.mocked(fetchProductFromChain).mockResolvedValue(fresh);
    vi.mocked(productDb.upsert).mockReturnValue(
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions, @typescript-eslint/no-explicit-any
      Promise.resolve(err(new Error('db error'))) as any,
    );

    const result = await commitmentUseCase.commitProductByIdentifier('app.dot');

    expect(result).toBeNull();
  });
});

describe('commitResolvedProduct', () => {
  it('persists the given Product without a chain call', async () => {
    const product = makeProduct();
    const saved = makeRecord({ pinned: false });

    vi.mocked(productDb.getByBaseName).mockReturnValue(
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions, @typescript-eslint/no-explicit-any
      Promise.resolve(ok(null)) as any,
    );
    vi.mocked(productDb.upsert).mockReturnValue(
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions, @typescript-eslint/no-explicit-any
      Promise.resolve(ok(saved)) as any,
    );

    const result = await commitmentUseCase.commitResolvedProduct(product);

    expect(fetchProductFromChain).not.toHaveBeenCalled();
    expect(productDb.upsert).toHaveBeenCalledWith(product, { pinned: false });
    expect(result).toBe(saved);
  });

  it('is idempotent — returns the existing row without re-persisting', async () => {
    const product = makeProduct();
    const row = makeRecord();

    vi.mocked(productDb.getByBaseName).mockReturnValue(
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions, @typescript-eslint/no-explicit-any
      Promise.resolve(ok(row)) as any,
    );

    const result = await commitmentUseCase.commitResolvedProduct(product);

    expect(result).toBe(row);
    expect(fetchProductFromChain).not.toHaveBeenCalled();
    expect(productDb.upsert).not.toHaveBeenCalled();
  });
});

describe('pinProduct', () => {
  it('ALWAYS re-resolves chain (even when row exists) and upserts with pinned:true', async () => {
    const fresh = makeProduct({ displayName: 'Fresh' });
    const saved = makeRecord({ pinned: true });

    // Existing row in DB — should NOT short-circuit chain call
    vi.mocked(productDb.getByBaseName).mockReturnValue(
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions, @typescript-eslint/no-explicit-any
      Promise.resolve(ok(makeRecord())) as any,
    );
    vi.mocked(fetchProductFromChain).mockResolvedValue(fresh);
    vi.mocked(productDb.upsert).mockReturnValue(
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions, @typescript-eslint/no-explicit-any
      Promise.resolve(ok(saved)) as any,
    );

    const result = await commitmentUseCase.pinProduct('app.dot');

    expect(fetchProductFromChain).toHaveBeenCalledWith('app.dot');
    expect(productDb.upsert).toHaveBeenCalledWith(fresh, { pinned: true });
    expect(result).toBe(saved);
  });

  it('drops the chain-resolve cache entry', async () => {
    const fresh = makeProduct();
    const saved = makeRecord({ pinned: true });

    vi.mocked(fetchProductFromChain).mockResolvedValue(fresh);
    vi.mocked(productDb.upsert).mockReturnValue(
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions, @typescript-eslint/no-explicit-any
      Promise.resolve(ok(saved)) as any,
    );

    await commitmentUseCase.pinProduct('app.dot');

    expect(invalidateChainResolve).toHaveBeenCalledWith('app.dot');
  });

  it('returns null when chain returns nothing', async () => {
    vi.mocked(fetchProductFromChain).mockResolvedValue(null);

    const result = await commitmentUseCase.pinProduct('app.dot');

    expect(result).toBeNull();
    expect(productDb.upsert).not.toHaveBeenCalled();
  });

  it('kicks off archive prefetch after persisting the pinned row', async () => {
    const fresh = makeProduct({ displayName: 'Fresh' });
    const saved = makeRecord({ pinned: true });

    vi.mocked(fetchProductFromChain).mockResolvedValue(fresh);
    vi.mocked(productDb.upsert).mockReturnValue(
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions, @typescript-eslint/no-explicit-any
      Promise.resolve(ok(saved)) as any,
    );
    const prefetch = vi.spyOn(offlineCacheUseCase, 'prefetchArchives').mockResolvedValue();

    await commitmentUseCase.pinProduct('app.dot');

    expect(prefetch).toHaveBeenCalledTimes(1);
    expect(prefetch).toHaveBeenCalledWith(saved);
  });
});

describe('unpinProduct', () => {
  it('flips pinned:false and returns true', async () => {
    vi.mocked(productDb.update).mockReturnValue(
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions, @typescript-eslint/no-explicit-any
      Promise.resolve(ok('app.dot')) as any,
    );

    const result = await commitmentUseCase.unpinProduct('app.dot');

    expect(productDb.update).toHaveBeenCalledWith('app.dot', expect.objectContaining({ pinned: false }));
    expect(result).toBe(true);
  });

  it('returns false when update fails', async () => {
    vi.mocked(productDb.update).mockReturnValue(
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions, @typescript-eslint/no-explicit-any
      Promise.resolve(err(new Error('db error'))) as any,
    );

    const result = await commitmentUseCase.unpinProduct('app.dot');

    expect(result).toBe(false);
  });
});
