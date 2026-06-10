import { dotNsService } from '../dotns/service';
import { type PersistedProduct, productDb } from '../product/repository';
import { invalidateChainResolve } from '../product/resource';
import { type Product } from '../product/types';

import { offlineCacheUseCase } from './offlineCache';
import { resolveProductUseCase } from './resolve';

// Persist a resolved Product as an unpinned commitment and drop the now-redundant
// chain-resolve cache entry (the id has a committed row now). Shared by both commit paths.
async function persistCommitted(baseName: string, product: Product): Promise<PersistedProduct | null> {
  const saved = await productDb.upsert(product, { pinned: false });
  if (saved.isErr()) return null;

  invalidateChainResolve(baseName);
  return saved.value;
}

// Flow B, caller already has the Product (e.g. an install flow that resolved it):
// commit it without a chain round-trip. Idempotent — an existing row wins.
async function commitResolvedProduct(product: Product): Promise<PersistedProduct | null> {
  const existing = await productDb.getByBaseName(product.baseName);
  if (existing.isOk() && existing.value) return existing.value;

  return persistCommitted(product.baseName, product);
}

// Flow B, caller only has a dotNS identifier (e.g. a chat reference): resolve it
// from chain first, then commit. Idempotent — an existing row skips the chain.
async function commitProductByIdentifier(identifier: string): Promise<PersistedProduct | null> {
  const baseName = dotNsService.baseNameOf(identifier);

  const existing = await productDb.getByBaseName(baseName);
  if (existing.isOk() && existing.value) return existing.value;

  const product = await resolveProductUseCase.fetchProductFromChain(baseName);
  if (!product) return null;

  return persistCommitted(baseName, product);
}

// "Pin the CURRENT version" — always re-resolves chain before writing.
// Used for both initial pinning and "Update Version" (re-pin to fresh chain state).
async function pinProduct(identifier: string): Promise<PersistedProduct | null> {
  const baseName = dotNsService.baseNameOf(identifier);

  const fresh = await resolveProductUseCase.fetchProductFromChain(baseName);
  if (!fresh) return null;

  const saved = await productDb.upsert(fresh, { pinned: true });
  if (saved.isErr()) return null;

  invalidateChainResolve(baseName);
  void offlineCacheUseCase.prefetchArchives(saved.value);
  return saved.value;
}

// An already-committed row stays committed — only the `pinned` flag flips, so no
// chain-resolve cache entry exists to invalidate.
async function unpinProduct(identifier: string): Promise<boolean> {
  // Normalize like pinProduct so the DB key and the evicted archive domains line
  // up regardless of how the caller spelled the identifier.
  const baseName = dotNsService.baseNameOf(identifier);
  const result = await productDb.update(baseName, { pinned: false, updatedAt: Date.now() });
  if (result.isErr()) return false;
  await offlineCacheUseCase.evictArchives(baseName);
  return true;
}

export const commitmentUseCase = {
  commitResolvedProduct,
  commitProductByIdentifier,
  pinProduct,
  unpinProduct,
};
