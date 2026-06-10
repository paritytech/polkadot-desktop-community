/* eslint-disable no-console */
import ts from 'typescript';

// Filesystem-safe slug for a package name (drop leading @, slashes -> __).
export function flattenPackageName(name) {
  return name.replace(/^@/, '').replace(/\//g, '__');
}

// Resolve a package's TypeScript types entry from its package.json object.
// Returns a path relative to the package root, or null if none is declared.
export function resolveTypesEntry(pkgJson) {
  const exp = pkgJson.exports;
  if (exp && typeof exp === 'object') {
    const dot = exp['.'];
    if (typeof dot === 'string') return dot.endsWith('.d.ts') ? dot : null;
    if (dot && typeof dot === 'object') {
      if (typeof dot.types === 'string') return dot.types;
      if (dot.import && typeof dot.import.types === 'string') return dot.import.types;
    }
  }
  if (typeof pkgJson.types === 'string') return pkgJson.types;
  if (typeof pkgJson.typings === 'string') return pkgJson.typings;
  return null;
}

// Resolve a re-export (`export { x }` / `export { x } from '...'`) to the symbol
// it actually points at. Barrel exports surface as Alias symbols whose own
// declaration is just the specifier (`x`) and whose flags carry no concrete
// kind — the real declaration, JSDoc, and signature live on the target.
function aliasTarget(symbol, checker) {
  if (checker && symbol.flags & ts.SymbolFlags.Alias) {
    try {
      const target = checker.getAliasedSymbol(symbol);
      if (target) return target;
    } catch {
      /* keep original symbol */
    }
  }
  return symbol;
}

function kindOfSymbol(symbol, checker) {
  const f = aliasTarget(symbol, checker).flags;
  if (f & ts.SymbolFlags.Function) return 'function';
  if (f & ts.SymbolFlags.Method) return 'function';
  if (f & ts.SymbolFlags.Class) return 'class';
  if (f & ts.SymbolFlags.Enum) return 'enum';
  if (f & ts.SymbolFlags.TypeAlias) return 'type';
  if (f & ts.SymbolFlags.Interface) return 'type';
  if (f & ts.SymbolFlags.Module) return 'namespace';
  if (f & (ts.SymbolFlags.Variable | ts.SymbolFlags.BlockScopedVariable)) return 'const';
  if (f & ts.SymbolFlags.Property) return 'const';
  return 'other';
}

// Extract the public export surface of a package given the ABSOLUTE path to its
// types entry (.d.ts). Resolves re-exports across files via the type checker.
// Returns: Array<{ name, kind, jsdoc, signature }>.
export function extractPackageSurface(entryAbsPath) {
  const program = ts.createProgram([entryAbsPath], {
    noEmit: true,
    skipLibCheck: true,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
  });
  const checker = program.getTypeChecker();
  const src = program.getSourceFile(entryAbsPath);
  if (!src) throw new Error(`cannot load types entry: ${entryAbsPath}`);
  const moduleSymbol = checker.getSymbolAtLocation(src);
  if (!moduleSymbol) return [];

  const entries = [];
  for (const sym of checker.getExportsOfModule(moduleSymbol)) {
    // Read the declaration/JSDoc from the alias target so barrel re-exports
    // (`export { produce }`) yield the real signature, not the bare specifier.
    const target = aliasTarget(sym, checker);
    const decls = (target.declarations?.length ? target.declarations : sym.declarations) ?? [];
    if (decls.length === 0) continue;
    const doc = target.getDocumentationComment(checker);
    const jsdoc = ts
      .displayPartsToString(doc.length ? doc : sym.getDocumentationComment(checker))
      .split('\n')[0]
      .trim();
    entries.push({
      name: sym.getName(), // exported name (post-rename), e.g. `nothing`
      kind: kindOfSymbol(sym, checker),
      jsdoc,
      // Join all declarations so overloaded functions keep every signature.
      signature: decls.map((d) => d.getText().trim()).join('\n'),
    });
  }
  return entries;
}

// One tab-separated row per export for the aggregate grep table.
export function toSymbolsRows(entries, packageName) {
  return entries.map(
    (e) => `${e.name}\t${e.kind}\t${packageName}\t${(e.jsdoc || '').replace(/\t/g, ' ')}`,
  );
}

// Per-package markdown: description + signatures grouped by kind.
export function renderPackageMd({ name, description, entries }) {
  const lines = [`# ${name}`, '', description || '_(no description)_', ''];
  const byKind = new Map();
  for (const e of entries) {
    if (!byKind.has(e.kind)) byKind.set(e.kind, []);
    byKind.get(e.kind).push(e);
  }
  for (const [kind, list] of byKind) {
    lines.push(`## ${kind}`, '');
    for (const e of list) {
      if (e.jsdoc) lines.push(`<!-- ${e.jsdoc} -->`);
      lines.push('```ts', e.signature, '```', '');
    }
  }
  return lines.join('\n');
}
