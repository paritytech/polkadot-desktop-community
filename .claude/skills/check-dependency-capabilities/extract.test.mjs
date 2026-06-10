/* eslint-disable no-console */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { flattenPackageName, resolveTypesEntry } from './extract.mjs';

test('flattenPackageName strips @ and replaces /', () => {
  assert.equal(flattenPackageName('lodash-es'), 'lodash-es');
  assert.equal(flattenPackageName('@novasamatech/host-api'), 'novasamatech__host-api');
});

test('resolveTypesEntry reads exports["."].types', () => {
  const pkg = { exports: { '.': { types: './dist/index.d.ts', default: './dist/index.js' } } };
  assert.equal(resolveTypesEntry(pkg), './dist/index.d.ts');
});

test('resolveTypesEntry reads top-level types field', () => {
  assert.equal(resolveTypesEntry({ types: './dist/index.d.ts' }), './dist/index.d.ts');
  assert.equal(resolveTypesEntry({ typings: './t.d.ts' }), './t.d.ts');
});

test('resolveTypesEntry returns null when no types', () => {
  assert.equal(resolveTypesEntry({ main: './index.js' }), null);
});

import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { extractPackageSurface } from './extract.mjs';

test('extractPackageSurface returns exported symbols with kind + jsdoc', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cdc-'));
  const entry = join(dir, 'index.d.ts');
  writeFileSync(
    entry,
    [
      'export declare function add(a: number, b: number): number;',
      '/** Greets a user. */',
      'export declare const greeting: string;',
      'export type ID = string | number;',
    ].join('\n'),
  );

  const surface = extractPackageSurface(entry);
  const byName = Object.fromEntries(surface.map((e) => [e.name, e]));

  assert.equal(byName.add.kind, 'function');
  assert.equal(byName.greeting.kind, 'const');
  assert.equal(byName.greeting.jsdoc, 'Greets a user.');
  assert.equal(byName.ID.kind, 'type');
  assert.match(byName.add.signature, /add\(a: number, b: number\): number/);
});

test('extractPackageSurface follows export {} barrel aliases to the real declaration', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cdc-barrel-'));
  const entry = join(dir, 'index.d.ts');
  writeFileSync(
    entry,
    [
      '/** Produce the next state. */',
      'declare function produce(base: number): number;',
      'declare const NOTHING: unique symbol;',
      'export { produce, NOTHING as nothing };',
    ].join('\n'),
  );

  const surface = extractPackageSurface(entry);
  const byName = Object.fromEntries(surface.map((e) => [e.name, e]));

  // Exported under its barrel name, but the signature is the underlying declaration, not the bare specifier.
  assert.match(byName.produce.signature, /declare function produce\(base: number\): number/);
  assert.equal(byName.produce.jsdoc, 'Produce the next state.');
  // Renamed re-export: name is the export alias, signature resolves to the target declaration.
  assert.ok(byName.nothing, 'renamed export present under its alias');
  assert.match(byName.nothing.signature, /NOTHING/);
  assert.doesNotMatch(byName.nothing.signature, /^nothing$/);
});

import { toSymbolsRows, renderPackageMd } from './extract.mjs';

const SAMPLE = [
  { name: 'add', kind: 'function', jsdoc: 'Adds numbers.', signature: 'declare function add(a: number, b: number): number;' },
  { name: 'ID', kind: 'type', jsdoc: '', signature: 'type ID = string | number;' },
];

test('toSymbolsRows emits tab-separated rows, tabs in jsdoc neutralized', () => {
  const rows = toSymbolsRows(
    [{ name: 'x', kind: 'const', jsdoc: 'a\tb', signature: 'const x: number;' }],
    '@scope/pkg',
  );
  assert.equal(rows[0], 'x\tconst\t@scope/pkg\ta b');
});

test('renderPackageMd includes description, grouping, and signatures', () => {
  const md = renderPackageMd({ name: '@scope/pkg', description: 'My pkg.', entries: SAMPLE });
  assert.match(md, /# @scope\/pkg/);
  assert.match(md, /My pkg\./);
  assert.match(md, /## function/);
  assert.match(md, /declare function add/);
  assert.match(md, /Adds numbers\./);
});
