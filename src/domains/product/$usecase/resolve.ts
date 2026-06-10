import { namehash } from 'viem';

import { type HexString } from '@/shared/types';
import { dotNsGateway } from '../dotns/gateway';
import { dotNsService } from '../dotns/service';
import { EXECUTABLE_KINDS, EXECUTABLE_TEXT_RECORD_KEY, MANIFEST_TEXT_RECORD_KEY } from '../product/manifest/constants';
import { manifestService } from '../product/manifest/service';
import { type RootManifest } from '../product/manifest/types';
import { type PersistedProduct, productDb } from '../product/repository';
import { type Product } from '../product/types';

// How many unpinned products `reconcileUnpinnedProducts` re-resolves concurrently.
// Each row is ~10 RPC reads, so this caps the launch-time burst on the dotNS endpoint.
const RECONCILE_BATCH_SIZE = 4;

// Read the `Product` fields off a `PersistedProduct`, dropping persistence metadata
// (`pinned`, timestamps) that consumers of the canonical struct shouldn't see.
function recordToProduct(record: PersistedProduct): Product {
  return {
    baseName: record.baseName,
    displayName: record.displayName,
    description: record.description,
    icon: record.icon,
    executables: record.executables,
    ...(record.owner ? { owner: record.owner } : {}),
  };
}

// Synthetic root for legacy products — no `manifest` record means no metadata,
// so surface the bare base name and let downstream defaults apply (the icon
// hook returns null for an empty cid).
function legacyRoot(baseName: string): RootManifest {
  return {
    $v: 1,
    displayName: baseName,
    description: '',
    icon: { cid: '', format: 'png' },
  };
}

// Legacy branch (pre-manifest): contenthash on the global content-resolver
// contract, with no registry resolver indirection — exactly how the app
// resolved products before manifests. The app archive lives at the bare base,
// so the synthesized app executable's identifier IS the base name (not
// `app.<base>` like the manifest branch).
async function resolveLegacy(baseName: string): Promise<Product | null> {
  const contenthash = await dotNsGateway.readLegacyContentHash(namehash(baseName));
  if (!contenthash) return null;

  return manifestService.assembleProduct({
    baseName,
    root: legacyRoot(baseName),
    executables: { app: { kind: 'app', identifier: baseName, appVersion: [0, 0, 0], contenthash } },
  });
}

// Manifest branch: metadata in the base `manifest` record; each kind
// lives at its own `<kind>.<base>` subname with its own resolver + contenthash.
async function resolveFromManifest(baseName: string, rootText: string, owner: HexString | null): Promise<Product | null> {
  const root = manifestService.parseRootManifest(rootText);
  if (!root) return null;

  const entries = await Promise.all(
    EXECUTABLE_KINDS.map(async kind => {
      const subnode = namehash(dotNsService.subnameOf(baseName, kind));
      const subResolver = await dotNsGateway.readResolver(subnode);
      if (!subResolver) return null;
      const [text, contenthash] = await Promise.all([
        dotNsGateway.readText(subResolver, subnode, EXECUTABLE_TEXT_RECORD_KEY),
        dotNsGateway.readContentHashAt(subResolver, subnode),
      ]);
      if (!contenthash) return null;
      const manifest = manifestService.parseExecutableManifest(text, kind);
      if (!manifest) return null;
      return { manifest, contenthash };
    }),
  );

  const executables = manifestService.executablesFromManifests(baseName, entries);
  return manifestService.assembleProduct({ baseName, root, executables, owner: owner ?? undefined });
}

// Manifest resolution if the base node has a registry resolver carrying a
// `manifest` record; otherwise legacy (contenthash on the global content resolver, no
// registry entry required). The registry lookup gates only the manifest path —
// legacy products predate it, so a missing resolver must NOT block resolution.
// Null only when neither path finds anything. The canonical chain-resolve
// primitive — exposed on `resolveProductUseCase`, not as a bare export, so
// other use cases reach it through the group surface.
async function fetchProductFromChain(baseName: string): Promise<Product | null> {
  const node = namehash(baseName);
  const resolver = await dotNsGateway.readResolver(node);

  if (resolver) {
    const [rootText, owner] = await Promise.all([
      dotNsGateway.readText(resolver, node, MANIFEST_TEXT_RECORD_KEY),
      dotNsGateway.readOwner(node).catch(() => null),
    ]);
    if (rootText) return resolveFromManifest(baseName, rootText, owner);
  }

  return resolveLegacy(baseName);
}

// Imperative blend read: the Product for an identifier, preferring the committed
// row and falling back to chain resolution for uncommitted ids. Pure — never
// writes the DB. (Refreshing stale unpinned rows is `reconcileUnpinnedProducts`,
// run on its own trigger; the React equivalent of this read is
// `useDisplayedProduct`.) For non-React callers that need the value once, on demand.
async function resolveProduct(identifier: string): Promise<Product | null> {
  const baseName = dotNsService.baseNameOf(identifier);

  const stored = await productDb.getByBaseName(baseName);
  if (stored.isOk() && stored.value) return recordToProduct(stored.value);

  return fetchProductFromChain(baseName);
}

// Re-resolve every committed *unpinned* product against the chain and persist
// any drift. Explicit, owned refresh — run on a defined trigger (app launch),
// NOT as a side effect of viewing a product. Pinned rows are frozen and skipped;
// the row write goes through `productDb.update` (liveQuery re-emits, so the UI
// refreshes), and committed products are never in the chain-resolve cache, so no
// cache invalidation is needed here. Best-effort per row: one failure never
// blocks the others. The chain fan-out is batched (see RECONCILE_BATCH_SIZE) so
// launch doesn't hit the dotNS endpoint with every product at once.
async function reconcileUnpinnedProducts(): Promise<void> {
  const stored = await productDb.getAll();
  if (stored.isErr()) {
    console.warn('[reconcileUnpinnedProducts] could not read products:', stored.error);
    return;
  }

  const unpinned = stored.value.filter(row => !row.pinned);
  for (let i = 0; i < unpinned.length; i += RECONCILE_BATCH_SIZE) {
    await Promise.all(unpinned.slice(i, i + RECONCILE_BATCH_SIZE).map(reconcileRow));
  }
}

async function reconcileRow(row: PersistedProduct): Promise<void> {
  try {
    const fresh = await fetchProductFromChain(row.baseName);
    if (!fresh || !productDiffers(row, fresh)) return;

    const updateResult = await productDb.update(row.baseName, {
      displayName: fresh.displayName,
      description: fresh.description,
      icon: fresh.icon,
      executables: fresh.executables,
      owner: fresh.owner,
      updatedAt: Date.now(),
    });
    if (updateResult.isErr()) {
      console.warn(`[reconcileUnpinnedProducts] update failed for ${row.baseName}:`, updateResult.error);
    }
  } catch (err) {
    console.warn(`[reconcileUnpinnedProducts] re-resolve failed for ${row.baseName}:`, err);
  }
}

function productDiffers(stored: PersistedProduct, fresh: Product): boolean {
  if (stored.displayName !== fresh.displayName) return true;
  if (stored.description !== fresh.description) return true;
  if (stored.icon.cid !== fresh.icon.cid || stored.icon.format !== fresh.icon.format) return true;
  if ((stored.owner ?? null) !== (fresh.owner ?? null)) return true;
  for (const kind of EXECUTABLE_KINDS) {
    const a = stored.executables[kind];
    const b = fresh.executables[kind];
    if (!!a !== !!b) return true;
    if (a && b && a.contenthash !== b.contenthash) return true;
  }
  return false;
}

export const resolveProductUseCase = {
  resolveProduct,
  fetchProductFromChain,
  reconcileUnpinnedProducts,
};
