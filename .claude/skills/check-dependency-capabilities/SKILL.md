---
name: check-dependency-capabilities
description: Use before writing any non-trivial utility, helper, algorithm, data transformation, or wrapper that an installed dependency might already provide. Symptoms — about to hand-roll debounce/merge/groupBy/retry, a stream operator, a validator, or a wrapper around a first-party host/SDK package whose API you don't have in context.
---

# Check Dependency Capabilities

Before hand-writing a utility/helper/wrapper, check whether an installed package already exports it. The index under `index/` is generated from every dependency's `.d.ts` (the authoritative, version-matched API surface).

## Steps

0. **Ensure the index exists and is fresh.** The index is gitignored, so on a fresh clone it won't exist yet. Run the generator if `index/symbols.tsv` is missing, if `index/.manifest.json` doesn't match current dependency versions, or if `package.json`/`package-lock.json` changed since the manifest:

   ```bash
   node .claude/skills/check-dependency-capabilities/generate.mjs
   ```

   It regenerates only changed packages (near-instant when nothing changed; full build only on first run).

1. **Grep the symbol table** for the capability — try the concept and likely names:

   ```bash
   grep -iP '\t(function|const|type|class)\t' .claude/skills/check-dependency-capabilities/index/symbols.tsv | grep -i 'debounce'
   ```

   Columns are `symbol⇥kind⇥package⇥jsdoc-first-line`. A hit means a package already provides it.

2. **Read the matched package's signatures** for exact usage (one scoped file, e.g.):

   ```bash
   cat .claude/skills/check-dependency-capabilities/index/lodash-es.md
   ```

   (Slug rule: drop a leading `@`, replace `/` with `__` — `@novasamatech/host-api` → `novasamatech__host-api.md`.)

3. **Decide.** Use the existing export if it fits. Only if nothing matches, write new code — and say in one line what you searched and why nothing fit.

## Maintenance

The index is **gitignored** (project-specific derived data) and regenerated incrementally by `generate.mjs` (driven by `index/.manifest.json`). Config (scope, dev deps) lives at the top of `generate.mjs`. The generator and its `node:test` suites are self-contained in this folder — no project wiring.
