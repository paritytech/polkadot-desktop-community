import { isElectron } from '@/shared/env';
import { type HexString } from '@/shared/types';
import { type ArchiveContent } from '@/domains/network';
import { type ProductArchive } from '../manifest/types';

// Typed boundary over the main-process disk archive store, reached from the
// renderer through `window.App` IPC. Every method folds the `isElectron()`
// guard: on web the disk store does not exist, so reads return empty and
// writes are no-op successes. Consumed by the offline-first load use case and
// the offline-cache use case — never `window.App` directly.

type ArchiveWriteResult = { success: true } | { success: false; error: string };

// Whether the disk store already holds the bytes for (domain, contenthash).
async function has(domain: string, contenthash: HexString): Promise<boolean> {
  if (!isElectron()) return false;
  return window.App.hasArchive(domain, contenthash);
}

// Pull persisted bytes back into the renderer (workers run in-process). Null on
// web or when the bytes are absent / went missing mid-pull.
async function get(domain: string, contenthash: HexString): Promise<{ origin: string; files: ArchiveContent } | null> {
  if (!isElectron()) return null;
  return window.App.getArchive(domain, contenthash);
}

// Warm main's in-memory cache only (non-durable; survives until quit). No-op
// success on web.
async function warm(archive: ProductArchive): Promise<ArchiveWriteResult> {
  if (!isElectron()) return { success: true };
  return window.App.saveArchive(archive);
}

// Durably persist to disk keyed by contenthash (survives restart). No-op
// success on web.
async function persist(archive: ProductArchive, contenthash: HexString): Promise<ArchiveWriteResult> {
  if (!isElectron()) return { success: true };
  return window.App.persistArchive(archive, contenthash);
}

// Remove the disk bytes for a domain. No-op on web.
async function remove(domain: string): Promise<void> {
  if (!isElectron()) return;
  await window.App.deleteArchive(domain);
}

// Domains currently persisted on disk (empty on web).
async function list(): Promise<{ domain: string; contenthash: string; sizeBytes: number }[]> {
  if (!isElectron()) return [];
  return window.App.listPersistedArchives();
}

export const archiveStoreGateway = { has, get, warm, persist, remove, list };
