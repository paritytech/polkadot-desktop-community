import { errAsync, okAsync } from 'neverthrow';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../product/repository', () => ({
  productDb: {
    getAll: vi.fn(),
    getByBaseName: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('../dotns/service', () => ({
  dotNsService: {
    baseNameOf: vi.fn((id: string) => (id.endsWith('.dot') ? id : `${id}.dot`)),
    subnameOf: vi.fn((base: string, sub: string) => `${sub}.${base}`),
  },
}));

vi.mock('../dotns/gateway', () => ({
  dotNsGateway: {
    readResolver: vi.fn(),
    readOwner: vi.fn(),
    readText: vi.fn(),
    readContentHashAt: vi.fn(),
    readLegacyContentHash: vi.fn(),
  },
}));

vi.mock('../product/manifest/service', () => ({
  manifestService: {
    parseRootManifest: vi.fn(),
    parseExecutableManifest: vi.fn(),
    assembleProduct: vi.fn(),
    executablesFromManifests: vi.fn(),
  },
}));

import { dotNsGateway } from '../dotns/gateway';
import { manifestService } from '../product/manifest/service';
import { type PersistedProduct, productDb } from '../product/repository';
import { type Product } from '../product/types';

import { resolveProductUseCase } from './resolve';

function makeRecord(overrides: Partial<PersistedProduct> = {}): PersistedProduct {
  return {
    baseName: 'app.dot',
    displayName: 'App',
    description: '',
    icon: { cid: 'abc', format: 'png' },
    executables: {},
    pinned: false,
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides,
  };
}

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    baseName: 'app.dot',
    displayName: 'App',
    description: '',
    icon: { cid: 'abc', format: 'png' },
    executables: {},
    ...overrides,
  };
}

// Drive `fetchProductFromChain` down its legacy branch (no registry resolver →
// legacy contenthash → assembleProduct) so it yields the given product.
function mockChainReturnsProduct(product: Product) {
  vi.mocked(dotNsGateway.readResolver).mockResolvedValue(null);
  vi.mocked(dotNsGateway.readLegacyContentHash).mockResolvedValue('0xdeadbeef');
  vi.mocked(manifestService.assembleProduct).mockReturnValue(product);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(productDb.update).mockReturnValue(okAsync('app.dot'));
});

describe('resolveProduct', () => {
  it('returns the committed row (as a Product) without a chain call', async () => {
    vi.mocked(productDb.getByBaseName).mockReturnValue(okAsync(makeRecord({ displayName: 'Stored' })));

    const result = await resolveProductUseCase.resolveProduct('app.dot');

    expect(result).toEqual(expect.objectContaining({ baseName: 'app.dot', displayName: 'Stored' }));
    // pure read — no persistence metadata leaks out
    expect(result).not.toHaveProperty('pinned');
    expect(dotNsGateway.readResolver).not.toHaveBeenCalled();
  });

  it('falls back to chain resolution when no row is committed', async () => {
    vi.mocked(productDb.getByBaseName).mockReturnValue(okAsync(null));
    mockChainReturnsProduct(makeProduct({ displayName: 'FromChain' }));

    const result = await resolveProductUseCase.resolveProduct('app.dot');

    expect(result).toEqual(expect.objectContaining({ displayName: 'FromChain' }));
    expect(dotNsGateway.readLegacyContentHash).toHaveBeenCalled();
  });

  it('never writes the DB', async () => {
    vi.mocked(productDb.getByBaseName).mockReturnValue(okAsync(makeRecord()));

    await resolveProductUseCase.resolveProduct('app.dot');

    expect(productDb.update).not.toHaveBeenCalled();
  });
});

describe('reconcileUnpinnedProducts', () => {
  it('re-resolves an unpinned row and persists the diff', async () => {
    vi.mocked(productDb.getAll).mockReturnValue(okAsync([makeRecord({ displayName: 'Old Name' })]));
    mockChainReturnsProduct(makeProduct({ displayName: 'New Name' }));

    await resolveProductUseCase.reconcileUnpinnedProducts();

    expect(productDb.update).toHaveBeenCalledWith('app.dot', expect.objectContaining({ displayName: 'New Name' }));
  });

  it('does not write when chain data matches the stored row', async () => {
    vi.mocked(productDb.getAll).mockReturnValue(okAsync([makeRecord({ displayName: 'Same' })]));
    mockChainReturnsProduct(makeProduct({ displayName: 'Same' }));

    await resolveProductUseCase.reconcileUnpinnedProducts();

    expect(productDb.update).not.toHaveBeenCalled();
  });

  it('skips pinned rows entirely — no chain call, no write', async () => {
    vi.mocked(productDb.getAll).mockReturnValue(okAsync([makeRecord({ pinned: true })]));
    mockChainReturnsProduct(makeProduct({ displayName: 'New Name' }));

    await resolveProductUseCase.reconcileUnpinnedProducts();

    expect(dotNsGateway.readResolver).not.toHaveBeenCalled();
    expect(productDb.update).not.toHaveBeenCalled();
  });

  it('reconciles only the unpinned rows in a mixed set', async () => {
    vi.mocked(productDb.getAll).mockReturnValue(
      okAsync([makeRecord({ baseName: 'pinned.dot', pinned: true }), makeRecord({ baseName: 'fresh.dot', displayName: 'Old' })]),
    );
    mockChainReturnsProduct(makeProduct({ displayName: 'New' }));

    await resolveProductUseCase.reconcileUnpinnedProducts();

    expect(productDb.update).toHaveBeenCalledTimes(1);
    expect(productDb.update).toHaveBeenCalledWith('fresh.dot', expect.objectContaining({ displayName: 'New' }));
  });

  it('does nothing when the product list cannot be read', async () => {
    vi.mocked(productDb.getAll).mockReturnValue(errAsync(new Error('db')));

    await resolveProductUseCase.reconcileUnpinnedProducts();

    expect(productDb.update).not.toHaveBeenCalled();
  });

  it('continues past a row whose chain re-resolve throws', async () => {
    vi.mocked(productDb.getAll).mockReturnValue(okAsync([makeRecord({ displayName: 'Old' })]));
    vi.mocked(dotNsGateway.readResolver).mockRejectedValue(new Error('rpc'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(resolveProductUseCase.reconcileUnpinnedProducts()).resolves.toBeUndefined();
    expect(productDb.update).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
