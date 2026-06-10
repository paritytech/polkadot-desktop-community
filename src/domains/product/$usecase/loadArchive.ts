import { dotNsService } from '../dotns/service';
import { archiveStoreGateway } from '../product/archive-store/gateway';
import { type ExecutableKind } from '../product/manifest/constants';
import { archiveGateway } from '../product/manifest/gateway';
import { type ExecutableContent } from '../product/manifest/types';
import { type Product } from '../product/types';

// Offline-first load of a product executable's archive. Multi-source: it reads
// the disk store, falls back to the IPFS gateway, and warms main's in-memory
// cache — so it is a use case, not a resource read. `executableArchiveResource`
// wraps it purely to add caching (the "resource over a use case" carve-out).
//
// Disk hit (Electron): workers pull their bytes back into the renderer;
// app/widget are served by the main process over `polkadot://`, so the webview
// only needs origin/domain (empty `files`). Miss: fetch from IPFS, warm main's
// in-memory cache, return the bytes. On web every load is an IPFS fetch.
async function loadExecutableArchive(product: Product, kind: ExecutableKind): Promise<ExecutableContent | null> {
  const executable = product.executables[kind];
  if (!executable) return null;
  const { identifier, contenthash } = executable;

  if (await archiveStoreGateway.has(identifier, contenthash)) {
    if (kind === 'worker') {
      const stored = await archiveStoreGateway.get(identifier, contenthash);
      if (stored) return { contenthash, archive: { domain: identifier, origin: stored.origin, files: stored.files } };
    } else {
      const origin = dotNsService.generateProductBase(identifier);
      return { contenthash, archive: { domain: identifier, origin, files: {} } };
    }
  }

  // Miss → fetch from IPFS. Unpinned products warm main's in-memory cache only;
  // durable disk persistence happens on pin via `offlineCacheUseCase`.
  const fetched = await archiveGateway.fetchExecutable(product, kind);
  if (!fetched) return null;
  // Only app/widget are served by main's polkadot:// handler out of its in-memory
  // cache, so only they need warming. Workers run in the renderer and consume the
  // returned files directly — warming main with worker bytes it never serves is
  // pure waste, so skip it.
  if (kind !== 'worker') {
    const result = await archiveStoreGateway.warm(fetched.archive);
    if (!result.success) {
      throw new Error(`Failed to register product: ${identifier}. Error: ${result.error}`);
    }
  }
  return fetched;
}

export const loadArchiveUseCase = { loadExecutableArchive };
