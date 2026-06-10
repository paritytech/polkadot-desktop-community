import { namehash } from 'viem';

import { createQueryResource } from '@/shared/resource';
import { type HexString } from '@/shared/types';
import { loadArchiveUseCase } from '../../$usecase/loadArchive';
import { dotNsGateway } from '../../dotns/gateway';
import { type Product } from '../types';

import { type ExecutableKind } from './constants';
import { type ExecutableContent } from './types';

// Cache identity per (product, kind, contenthash) — all three are needed so
// a new deployment (new contenthash) bypasses the old cached bytes.
export function archiveCacheKey(baseName: string, kind: ExecutableKind, contenthash: HexString): string {
  return `${baseName}#${kind}#${contenthash}`;
}

// Cache key for a (product, kind) with no executable present. Must stay
// byte-identical across the resource `key`, the cache `map`, and the read hook,
// or the "no executable" entry silently misses.
export function missingArchiveCacheKey(baseName: string, kind: ExecutableKind): string {
  return `${baseName}#${kind}#missing`;
}

// Per-executable archive read. Thin cache over `loadArchiveUseCase` — the
// offline-first orchestration (disk store → IPFS fallback → in-memory warm)
// lives in the use case because it spans multiple sources and performs a write;
// this resource adds nothing but the content-addressed cache (the documented
// "resource over a use case" carve-out). The contenthash is already on the
// Executable (populated at resolve time in `$usecase/resolve.ts`).
export const executableArchiveResource = createQueryResource<{ product: Product; kind: ExecutableKind }>({
  key: ({ product, kind }) => {
    const executable = product.executables[kind];
    return executable
      ? archiveCacheKey(product.baseName, kind, executable.contenthash)
      : missingArchiveCacheKey(product.baseName, kind);
  },
})
  .request<ExecutableContent | null>(({ product, kind }) => loadArchiveUseCase.loadExecutableArchive(product, kind))
  .timeout(60_000)
  .cache<Record<string, ExecutableContent | null>>({
    staleAfter: Number.POSITIVE_INFINITY,
    initial: {},
    map(cache, value, { product, kind }) {
      const executable = product.executables[kind];
      const cacheKey = executable
        ? archiveCacheKey(product.baseName, kind, executable.contenthash)
        : missingArchiveCacheKey(product.baseName, kind);
      // Store null too so subsequent mounts for the same (product, kind, contenthash)
      // read "no executable" from cache instead of re-firing the fetch.
      return { ...cache, [cacheKey]: value };
    },
  })
  .build();

// Read the already-cached archive for (product, kind) WITHOUT triggering a fetch.
// Returns null when nothing is cached, or when the cached entry carries no bytes
// (an app/widget entry served from disk is cached as `files: {}`). Lets the pin
// prefetch reuse bytes the user already downloaded by opening the product instead
// of re-fetching the same archive from IPFS.
export function peekExecutableArchive(product: Product, kind: ExecutableKind): ExecutableContent | null {
  const executable = product.executables[kind];
  if (!executable) return null;
  const cached = executableArchiveResource.snapshot()[archiveCacheKey(product.baseName, kind, executable.contenthash)];
  if (!cached || Object.keys(cached.archive.files).length === 0) return null;
  return cached;
}

// Evict the cached archive for a (baseName, kind, contenthash?).
// With contenthash: evicts a single exact entry.
// Without contenthash: evicts ALL entries for (baseName, kind) — useful when
// a product is refreshed and we don't have the old contenthash at hand.
export function invalidateExecutableArchive(baseName: string, kind: ExecutableKind, contenthash?: HexString): void {
  if (contenthash !== undefined) {
    // Single-entry eviction: synthesize a minimal Product whose key function produces this key.
    executableArchiveResource.invalidate({
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- key fn reads only baseName + executables[kind].contenthash
      product: { baseName, executables: { [kind]: { contenthash } } } as Product,
      kind,
    });
    return;
  }

  // Prefix eviction: iterate current cache keys and evict all matching (baseName, kind).
  const prefix = `${baseName}#${kind}#`;
  const currentCache = executableArchiveResource.snapshot();
  for (const cacheKey of Object.keys(currentCache)) {
    if (cacheKey.startsWith(prefix)) {
      // Extract the contenthash from the key suffix and invalidate that entry.
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- slice result is a valid HexString key
      const entryContenthash = cacheKey.slice(prefix.length) as HexString;
      executableArchiveResource.invalidate({
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- key fn reads only baseName + executables[kind].contenthash
        product: { baseName, executables: { [kind]: { contenthash: entryContenthash } } } as Product,
        kind,
      });
    }
  }
}

// Single-shot chain read of the current contenthash for (product, kind).
// Independent of `executableArchiveResource` — does NOT trigger an IPFS fetch.
// Used by the update-detection signal in offline-access.
export const liveContenthashResource = createQueryResource<{ product: Product; kind: ExecutableKind }>({
  key: ({ product, kind }) => `live:${product.baseName}#${kind}`,
})
  .request<HexString | null>(async ({ product, kind }) => {
    const executable = product.executables[kind];
    if (!executable) return null;
    const node = namehash(executable.identifier);
    const resolver = await dotNsGateway.readResolver(node);
    let contenthash = resolver ? await dotNsGateway.readContentHashAt(resolver, node) : null;
    contenthash ??= await dotNsGateway.readLegacyContentHash(node);
    return contenthash;
  })
  .timeout(15_000)
  .cache<Record<string, HexString | null>>({
    staleAfter: 30_000,
    initial: {},
    map(cache, value, { product, kind }) {
      return { ...cache, [`${product.baseName}#${kind}`]: value };
    },
  })
  .build();
