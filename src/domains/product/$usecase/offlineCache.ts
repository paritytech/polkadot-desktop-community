import { isElectron } from '@/shared/env';
import { dotNsService } from '../dotns/service';
import { archiveStoreGateway } from '../product/archive-store/gateway';
import { executableCacheRepository } from '../product/executable-cache/repository';
import { EXECUTABLE_KINDS } from '../product/manifest/constants';
import { archiveGateway } from '../product/manifest/gateway';
import { peekExecutableArchive } from '../product/manifest/resource';
import { productDb } from '../product/repository';
import { type Product } from '../product/types';

import { resolveProductUseCase } from './resolve';

// Download + persist every present executable archive for a product, tracking
// per-kind status in the index. Best-effort per kind; never throws.
async function prefetchArchives(product: Product): Promise<void> {
  if (!isElectron()) return;

  for (const kind of EXECUTABLE_KINDS) {
    const executable = product.executables[kind];
    if (!executable) continue;
    const domain = executable.identifier;

    await executableCacheRepository.setStatus(product.baseName, kind, domain, executable.contenthash, 'preparing');
    try {
      // Reuse bytes from an in-session IPFS fetch (e.g. the user opened the product
      // before pinning it) — avoids a redundant download and lets the pin succeed
      // offline. Disk-hit entries (cached as `files: {}`) and a cold cache both
      // return null here and fall through to a fresh IPFS fetch.
      const fetched = peekExecutableArchive(product, kind) ?? (await archiveGateway.fetchExecutable(product, kind));
      if (!fetched) {
        await executableCacheRepository.setStatus(product.baseName, kind, domain, executable.contenthash, 'failed');
        continue;
      }
      const sizeBytes = Object.values(fetched.archive.files).reduce((total, file) => total + file.byteLength, 0);
      const result = await archiveStoreGateway.persist(fetched.archive, fetched.contenthash);
      await executableCacheRepository.setStatus(
        product.baseName,
        kind,
        domain,
        fetched.contenthash,
        result.success ? 'ready' : 'failed',
        result.success ? sizeBytes : 0,
      );
    } catch (error) {
      console.warn('[offlineCache] prefetch failed for', product.baseName, kind, error);
      await executableCacheRepository.setStatus(product.baseName, kind, domain, executable.contenthash, 'failed');
    }
  }
}

// Remove disk bytes + index rows for every kind of a product. The gateway
// folds the web no-op, so no `isElectron()` guard is needed here; the index
// delete runs on web too (harmless — nothing is persisted there).
async function evictArchives(baseName: string): Promise<void> {
  for (const kind of EXECUTABLE_KINDS) {
    await archiveStoreGateway.remove(dotNsService.subnameOf(baseName, kind));
  }
  // Legacy products persist their app archive under the bare base name (the
  // legacy app executable's identifier IS the base, not `app.<base>`). Unpin
  // only runs evictArchives — forget also clears it via the sandbox — so drop
  // it here too or a legacy product's bytes leak on unpin.
  await archiveStoreGateway.remove(baseName);
  await executableCacheRepository.deleteByBaseName(baseName);
}

// On launch: every pinned product must have all present executables persisted.
// Any missing kind triggers a full re-pin (re-resolve from chain, then prefetch)
// so the row contenthash and disk bytes are rewritten together. Best-effort per product.
async function reconcilePinnedArchives(): Promise<void> {
  if (!isElectron()) return;

  const stored = await productDb.getAll();
  if (stored.isErr()) {
    console.warn('[offlineCache] could not read products:', stored.error);
    return;
  }

  for (const row of stored.value.filter(p => p.pinned)) {
    // Per-product try/catch: fetchProductFromChain can reject on any RPC failure,
    // and a rejection must not abort reconcile for the remaining pinned products
    // (mirrors reconcileRow in resolve.ts). Best-effort per product.
    try {
      let needsRepin = false;
      for (const kind of EXECUTABLE_KINDS) {
        const executable = row.executables[kind];
        if (!executable) continue;
        const present = await archiveStoreGateway.has(executable.identifier, executable.contenthash);
        if (!present) {
          needsRepin = true;
          break;
        }
      }
      if (!needsRepin) continue;

      const fresh = await resolveProductUseCase.fetchProductFromChain(row.baseName);
      if (!fresh) continue;
      // Re-pin and prefetch only after the row is committed, so the persisted
      // contenthash and the disk bytes stay in lockstep. If the upsert fails,
      // skip prefetch — otherwise disk would hold bytes the row doesn't reference.
      const upserted = await productDb.upsert(fresh, { pinned: true });
      if (upserted.isErr()) {
        console.warn('[offlineCache] re-pin upsert failed for', row.baseName, upserted.error);
        continue;
      }
      await prefetchArchives(upserted.value);
    } catch (error) {
      console.warn('[offlineCache] reconcile failed for', row.baseName, error);
    }
  }
}

// Launch-time cleanup: delete any on-disk archive whose product is no longer
// pinned (or no longer exists). Closes the gap where a failed unpin eviction — or
// a crash mid-unpin — leaves persisted bytes with nothing to remove them.
// Best-effort; the disk store is authoritative and the index is reconciled to it.
async function sweepOrphanedArchives(): Promise<void> {
  if (!isElectron()) return;

  const stored = await productDb.getAll();
  if (stored.isErr()) {
    console.warn('[offlineCache] could not read products for sweep:', stored.error);
    return;
  }

  const keep = new Set<string>();
  for (const row of stored.value.filter(p => p.pinned)) {
    for (const kind of EXECUTABLE_KINDS) keep.add(dotNsService.subnameOf(row.baseName, kind));
    keep.add(row.baseName); // legacy bare-name app archive
  }

  let onDisk: { domain: string; contenthash: string; sizeBytes: number }[];
  try {
    onDisk = await archiveStoreGateway.list();
  } catch (error) {
    console.warn('[offlineCache] could not list persisted archives for sweep:', error);
    return;
  }

  // Per-domain try/catch: one failing remove must not abort the sweep (best-effort,
  // mirrors the per-item isolation in reconcilePinnedArchives).
  for (const { domain } of onDisk) {
    if (keep.has(domain)) continue;
    try {
      await archiveStoreGateway.remove(domain);
    } catch (error) {
      console.warn('[offlineCache] sweep remove failed for', domain, error);
    }
  }
}

export const offlineCacheUseCase = { prefetchArchives, evictArchives, reconcilePinnedArchives, sweepOrphanedArchives };
