/* eslint-disable no-console */
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  rmSync,
  readdirSync,
} from 'node:fs';
import { dirname, join, resolve, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  resolveTypesEntry,
  flattenPackageName,
  extractPackageSurface,
  toSymbolsRows,
  renderPackageMd,
} from './extract.mjs';

const SKILL_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(SKILL_DIR, '../../..'); // .claude/skills/<skill> -> repo root
const INDEX_DIR = join(SKILL_DIR, 'index');
const BY_PKG_DIR = join(INDEX_DIR, 'by-package');
const MANIFEST_PATH = join(INDEX_DIR, '.manifest.json');
const SYMBOLS_PATH = join(INDEX_DIR, 'symbols.tsv');

// --- config: narrow scope here if ever needed ---
const INCLUDE_DEV = true;
const SCOPES = null; // null = every dependency; or e.g. ['@scope']

// Pure: which packages changed/were removed between two version manifests.
export function diffManifest(prev, curr) {
  const changed = [];
  for (const [name, ver] of Object.entries(curr)) {
    if (prev[name] !== ver) changed.push(name);
  }
  const removed = Object.keys(prev).filter((n) => !(n in curr));
  return { changed, removed };
}

function depNames(rootPkg) {
  const set = new Set([
    ...Object.keys(rootPkg.dependencies || {}),
    ...(INCLUDE_DEV ? Object.keys(rootPkg.devDependencies || {}) : []),
  ]);
  let names = [...set];
  if (SCOPES) names = names.filter((n) => SCOPES.some((s) => n === s || n.startsWith(`${s}/`)));
  return names.sort();
}

function readInstalledPkg(name) {
  const p = join(PROJECT_ROOT, 'node_modules', name, 'package.json');
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

// Regenerate one package's md + per-package tsv. Returns true on success.
function regeneratePackage(name) {
  const slug = flattenPackageName(name);
  const pkgJson = readInstalledPkg(name);
  if (!pkgJson) {
    console.warn(`[skip] ${name}: not installed`);
    return false;
  }
  // Resolve the types entry from the package itself, or fall back to its
  // DefinitelyTyped companion (@types/<slug>) when it ships no own .d.ts —
  // e.g. lodash-es / react get their surface from @types/lodash-es etc.
  let typesPkgDir = join(PROJECT_ROOT, 'node_modules', name);
  let rel = resolveTypesEntry(pkgJson);
  if (!rel) {
    // DefinitelyTyped companion: @scope/name -> @types/scope__name, name -> @types/name.
    // The DT mangling matches flattenPackageName for both scoped and unscoped names.
    const typesName = `@types/${flattenPackageName(name)}`;
    const typesPkg = readInstalledPkg(typesName);
    const typesRel = typesPkg ? resolveTypesEntry(typesPkg) || './index.d.ts' : null;
    if (typesRel) {
      rel = typesRel;
      typesPkgDir = join(PROJECT_ROOT, 'node_modules', typesName);
    }
  }
  if (!rel) {
    console.warn(`[skip] ${name}: no .d.ts types entry`);
    return false;
  }
  const entryAbs = isAbsolute(rel) ? rel : join(typesPkgDir, rel);
  if (!existsSync(entryAbs)) {
    console.warn(`[skip] ${name}: types entry missing on disk (${rel})`);
    return false;
  }
  let surface;
  try {
    surface = extractPackageSurface(entryAbs);
  } catch (err) {
    console.warn(`[skip] ${name}: extraction failed — ${err.message}`);
    return false;
  }
  if (surface.length === 0) {
    console.warn(`[skip] ${name}: no exports found`);
    return false;
  }
  writeFileSync(
    join(INDEX_DIR, `${slug}.md`),
    renderPackageMd({ name, description: pkgJson.description, entries: surface }),
  );
  writeFileSync(join(BY_PKG_DIR, `${slug}.tsv`), toSymbolsRows(surface, name).join('\n'));
  return true;
}

// Regenerate each target; if a target now yields no output (skipped), clear its
// stale `.md` / `.tsv` so the index never keeps entries for an API that no
// longer exists (e.g. a package upgraded to a typeless version — it counts as
// "changed", not "removed", so the removal loop alone would miss it).
export function regenerateTargets(targets, deps) {
  const { indexDir, byPkgDir, regenerate, flatten = flattenPackageName } = deps;
  for (const name of targets) {
    if (regenerate(name)) continue;
    const slug = flatten(name);
    rmSync(join(indexDir, `${slug}.md`), { force: true });
    rmSync(join(byPkgDir, `${slug}.tsv`), { force: true });
  }
}

function rebuildAggregateSymbols() {
  const rows = [];
  for (const file of readdirSync(BY_PKG_DIR).sort()) {
    if (!file.endsWith('.tsv')) continue;
    const body = readFileSync(join(BY_PKG_DIR, file), 'utf8').trim();
    if (body) rows.push(body);
  }
  writeFileSync(SYMBOLS_PATH, `${rows.join('\n')}\n`);
}

function main() {
  mkdirSync(BY_PKG_DIR, { recursive: true });
  const rootPkg = JSON.parse(readFileSync(join(PROJECT_ROOT, 'package.json'), 'utf8'));
  const names = depNames(rootPkg);

  const curr = {};
  for (const name of names) {
    const pj = readInstalledPkg(name);
    if (pj) curr[name] = pj.version;
  }
  const prev = existsSync(MANIFEST_PATH)
    ? JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'))
    : {};
  const { changed, removed } = diffManifest(prev, curr);

  // First run (empty prev) regenerates everything; otherwise only changed.
  const targets = Object.keys(prev).length === 0 ? names : changed;
  console.log(`Regenerating ${targets.length} package(s); removing ${removed.length}.`);

  const dirs = { indexDir: INDEX_DIR, byPkgDir: BY_PKG_DIR };
  // Removed packages never regenerate (regenerate => false), so they take the
  // same stale-file cleanup path as a target that produced no output.
  regenerateTargets(removed, { ...dirs, regenerate: () => false });
  regenerateTargets(targets, { ...dirs, regenerate: regeneratePackage });

  rebuildAggregateSymbols();
  writeFileSync(MANIFEST_PATH, `${JSON.stringify(curr, null, 2)}\n`);
  console.log(`Done. Index at ${INDEX_DIR}`);
}

// Run only when invoked directly, not when imported by tests.
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main();
}
