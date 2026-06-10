import { type Dirent } from 'node:fs';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

export type StoredArchive = { origin: string; files: Record<string, Uint8Array> };
type CurrentPointer = { contenthash: string; origin: string };

const CURRENT_FILE = 'current.json';

function domainDir(base: string, domain: string): string {
  return path.join(base, encodeURIComponent(domain));
}

async function readJson<T>(file: string): Promise<T | null> {
  try {
    // JSON.parse returns `any`; the function's declared return type T | null
    // makes the assignment type-safe without an explicit cast.
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {
    return null;
  }
}

// Recursively collect files under `dir` keyed by their forward-slash relative path.
async function readDirFiles(dir: string): Promise<Record<string, Uint8Array>> {
  const out: Record<string, Uint8Array> = {};

  async function walk(current: string, prefix: string): Promise<void> {
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const abs = path.join(current, entry.name);
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        await walk(abs, rel);
      } else {
        out[rel] = new Uint8Array(await fs.readFile(abs));
      }
    }
  }

  await walk(dir, '');
  return out;
}

// Recursively list forward-slash relative file paths under `dir` (no contents).
async function readDirPaths(dir: string): Promise<string[]> {
  const out: string[] = [];

  async function walk(current: string, prefix: string): Promise<void> {
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        await walk(path.join(current, entry.name), rel);
      } else {
        out.push(rel);
      }
    }
  }

  await walk(dir, '');
  return out;
}

async function dirSize(dir: string): Promise<number> {
  let total = 0;
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) total += await dirSize(abs);
    else total += (await fs.stat(abs)).size;
  }
  return total;
}

export function createArchiveStore(baseDir: string) {
  async function persist(domain: string, contenthash: string, origin: string, files: Record<string, Uint8Array>): Promise<void> {
    const dDir = domainDir(baseDir, domain);
    const finalDir = path.join(dDir, contenthash);
    const tmpDir = path.join(dDir, `${contenthash}.tmp`);

    // Stage into a tmp dir first, then rename into place for atomicity.
    await fs.rm(tmpDir, { recursive: true, force: true });
    for (const [filePath, content] of Object.entries(files)) {
      const dest = path.join(tmpDir, filePath);
      await fs.mkdir(path.dirname(dest), { recursive: true });
      await fs.writeFile(dest, content);
    }
    await fs.rm(finalDir, { recursive: true, force: true });
    await fs.rename(tmpDir, finalDir);

    // Flip the current pointer last.
    const pointer: CurrentPointer = { contenthash, origin };
    await fs.writeFile(path.join(dDir, CURRENT_FILE), JSON.stringify(pointer));

    // Remove stale contenthash dirs — retain only the active version.
    const entries = await fs.readdir(dDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && entry.name !== contenthash) {
        await fs.rm(path.join(dDir, entry.name), { recursive: true, force: true });
      }
    }
  }

  async function read(domain: string, contenthash: string): Promise<StoredArchive | null> {
    const dDir = domainDir(baseDir, domain);
    // Only the active version is retained on disk (persist prunes the rest), and
    // `origin` lives on the current pointer — so a request for any non-current
    // contenthash (or a missing pointer) is treated as absent rather than
    // returned with a blank origin.
    const pointer = await readJson<CurrentPointer>(path.join(dDir, CURRENT_FILE));
    if (!pointer || pointer.contenthash !== contenthash) return null;
    try {
      const readFiles = await readDirFiles(path.join(dDir, contenthash));
      return { origin: pointer.origin, files: readFiles };
    } catch {
      return null;
    }
  }

  async function readCurrent(domain: string): Promise<StoredArchive | null> {
    const pointer = await readJson<CurrentPointer>(path.join(domainDir(baseDir, domain), CURRENT_FILE));
    if (!pointer) return null;
    return read(domain, pointer.contenthash);
  }

  // Origin + the file path list for a serveable version — the header of a chunked
  // read. Same presence rule as read/has (pointer must name this contenthash).
  async function readManifest(domain: string, contenthash: string): Promise<{ origin: string; paths: string[] } | null> {
    const dDir = domainDir(baseDir, domain);
    const pointer = await readJson<CurrentPointer>(path.join(dDir, CURRENT_FILE));
    if (!pointer || pointer.contenthash !== contenthash) return null;
    try {
      const paths = await readDirPaths(path.join(dDir, contenthash));
      return { origin: pointer.origin, paths };
    } catch {
      return null;
    }
  }

  // One file's bytes from a serveable version — the body chunk of a chunked read.
  // Guards against traversal even if a malformed `filePath` slips the IPC validator:
  // the resolved target must stay inside the version dir.
  async function readFile(domain: string, contenthash: string, filePath: string): Promise<Uint8Array | null> {
    const dDir = domainDir(baseDir, domain);
    const pointer = await readJson<CurrentPointer>(path.join(dDir, CURRENT_FILE));
    if (!pointer || pointer.contenthash !== contenthash) return null;
    const versionDir = path.join(dDir, contenthash);
    const target = path.join(versionDir, filePath);
    const rel = path.relative(versionDir, target);
    if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) return null;
    try {
      return new Uint8Array(await fs.readFile(target));
    } catch {
      return null;
    }
  }

  // "Present" means "serveable", consistent with read/readCurrent: the current
  // pointer must name this contenthash AND its dir must exist. Checking the dir
  // alone would report true inside the persist crash-window (files renamed in,
  // current.json not yet written) — which would make reconcile skip a re-pin for
  // a product the protocol handler can't actually serve.
  async function has(domain: string, contenthash: string): Promise<boolean> {
    const dDir = domainDir(baseDir, domain);
    const pointer = await readJson<CurrentPointer>(path.join(dDir, CURRENT_FILE));
    if (!pointer || pointer.contenthash !== contenthash) return false;
    try {
      await fs.access(path.join(dDir, contenthash));
      return true;
    } catch {
      return false;
    }
  }

  async function remove(domain: string): Promise<void> {
    await fs.rm(domainDir(baseDir, domain), { recursive: true, force: true });
  }

  async function list(): Promise<{ domain: string; contenthash: string; sizeBytes: number }[]> {
    let entries: Dirent[];
    try {
      // withFileTypes so stray files (e.g. macOS `.DS_Store`) are skipped — a
      // non-encoded name would otherwise blow up `decodeURIComponent` below.
      entries = await fs.readdir(baseDir, { withFileTypes: true });
    } catch {
      return [];
    }
    const out: { domain: string; contenthash: string; sizeBytes: number }[] = [];
    for (const dirent of entries) {
      if (!dirent.isDirectory()) continue;
      const encoded = dirent.name;
      const dDir = path.join(baseDir, encoded);
      const pointer = await readJson<CurrentPointer>(path.join(dDir, CURRENT_FILE));
      if (!pointer) continue;
      const versionDir = path.join(dDir, pointer.contenthash);
      let sizeBytes = 0;
      try {
        sizeBytes = await dirSize(versionDir);
      } catch {
        continue;
      }
      out.push({ domain: decodeURIComponent(encoded), contenthash: pointer.contenthash, sizeBytes });
    }
    return out;
  }

  async function clearAll(): Promise<void> {
    await fs.rm(baseDir, { recursive: true, force: true });
  }

  return { persist, read, readCurrent, readManifest, readFile, has, delete: remove, list, clearAll };
}
