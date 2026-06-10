/* eslint-disable no-console */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { diffManifest, regenerateTargets } from './generate.mjs';

test('diffManifest reports changed + new + removed packages', () => {
  const prev = { a: '1.0.0', b: '2.0.0', gone: '1.0.0' };
  const curr = { a: '1.0.0', b: '2.1.0', c: '0.1.0' };
  const { changed, removed } = diffManifest(prev, curr);
  assert.deepEqual(changed.sort(), ['b', 'c']); // b version bump, c new
  assert.deepEqual(removed, ['gone']);
});

test('diffManifest with identical manifests yields no work', () => {
  const m = { a: '1.0.0' };
  assert.deepEqual(diffManifest(m, m), { changed: [], removed: [] });
});

test('regenerateTargets clears stale files for a target that no longer produces output', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cdc-gen-'));
  const indexDir = join(dir, 'index');
  const byPkgDir = join(indexDir, 'by-package');
  mkdirSync(byPkgDir, { recursive: true });

  // 'ghost' had output from a previous run; this run it yields nothing (e.g. upgraded to a typeless version).
  writeFileSync(join(indexDir, 'ghost.md'), '# ghost');
  writeFileSync(join(byPkgDir, 'ghost.tsv'), 'x\tfunction\tghost\t');
  // 'live' still regenerates fine and must be left untouched.
  writeFileSync(join(indexDir, 'live.md'), '# live');

  const regenerate = (name) => name === 'live'; // false => skipped/no output
  regenerateTargets(['live', 'ghost'], { indexDir, byPkgDir, regenerate });

  assert.equal(existsSync(join(indexDir, 'ghost.md')), false, 'stale md removed');
  assert.equal(existsSync(join(byPkgDir, 'ghost.tsv')), false, 'stale tsv removed');
  assert.equal(existsSync(join(indexDir, 'live.md')), true, 'healthy file untouched');
});
