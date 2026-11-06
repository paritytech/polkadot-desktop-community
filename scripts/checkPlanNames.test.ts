import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { checkPlanNames, formatReport, parsePlan, type Disk, type Tree } from './checkPlanNames.ts';

const TOP_LEVEL = new Set(['src', 'docs', 'scripts']);

const NO_BRANCHES = new Set<string>();

function createFakeTree(files: Record<string, string>): Tree {
  const isWordIn = (text: string, word: string): boolean => new RegExp(`(?<![A-Za-z0-9_$])${word}(?![A-Za-z0-9_$])`).test(text);
  return {
    hasPath: path => Object.keys(files).some(file => file === path || file.startsWith(`${path}/`)),
    readFile: path => files[path],
    listFilesWithWord: word =>
      Object.entries(files)
        .filter(([, text]) => isWordIn(text, word))
        .map(([file]) => file)
        .sort(),
    listFilesNamed: name =>
      Object.keys(files)
        .filter(file => file === name || file.endsWith(`/${name}`))
        .sort(),
  };
}

function createFakeDisk(ignored: Record<string, boolean>): Disk {
  return {
    isIgnored: path => path in ignored,
    exists: path => ignored[path] === true,
  };
}

const NO_DISK = createFakeDisk({});

const BUILTINS = new Set(['Promise', 'Record']);

function check(text: string, files: Record<string, string>, disk: Disk = NO_DISK) {
  const tree = createFakeTree(files);
  return checkPlanNames(parsePlan(text, TOP_LEVEL, NO_BRANCHES), tree, tree, disk, BUILTINS);
}

describe('parsePlan', () => {
  it('As a plan reviewer, I check a plan whose task lists its files and context and get each declared file, read file, bare file name and symbol', () => {
    // Given
    const text = [
      '### Task 1: Cache teardown',
      '',
      '**Files:**',
      '',
      '- Modify: `src/domains/network/createProductCache.ts`, `createChatTransport.ts`',
      '- Create: `src/domains/network/closeCache.ts`',
      '',
      '**Context:**',
      '',
      '- **Read:** `src/domains/network/createProductCache.ts`: `destroy`, `ProductCache.close()`, and `halt` in',
      '  `createChatTransport.ts`.',
      '- Rules: (docs/code/style.md § Errors)',
    ].join('\n');

    // When
    const plan = parsePlan(text, TOP_LEVEL, NO_BRANCHES);

    // Then
    assert.deepEqual(
      plan.declared.map(file => `${file.verb} ${file.path}`),
      [
        'Modify src/domains/network/createProductCache.ts',
        'Modify src/domains/network/createChatTransport.ts',
        'Create src/domains/network/closeCache.ts',
      ],
    );
    assert.deepEqual(
      plan.reads.map(entry => ({
        files: entry.files,
        bareNames: entry.bareNames,
        symbols: entry.symbols.map(symbol => symbol.name),
      })),
      [
        {
          files: ['src/domains/network/createProductCache.ts'],
          bareNames: ['createChatTransport.ts'],
          symbols: ['destroy', 'close', 'halt'],
        },
      ],
    );
    assert.deepEqual(plan.tasks, [{ line: 1, task: 'Task 1', hasRead: true }]);
  });

  it('As a plan reviewer, I check a plan that names a branch, a glob and code in a fence and none of them is looked up as a path', () => {
    // Given
    const text = [
      '- Branch: `docs/plan-review`. Out of scope: `docs/**`.',
      '',
      '```ts',
      "import { x } from 'src/features/chat/fenced.ts';",
      '```',
    ].join('\n');

    // When
    const plan = parsePlan(text, TOP_LEVEL, new Set(['docs/plan-review']));

    // Then
    assert.deepEqual(plan.paths, []);
    assert.deepEqual(
      plan.skipped.map(item => `${item.token} is ${item.reason}`),
      ['docs/plan-review is a branch name', 'docs/** is a pattern, not a path'],
    );
  });

  it('As a plan reviewer, I check declared lines whose label holds code or whose list wraps and get every file they declare', () => {
    // Given
    const text = [
      '- Modify (script, `f(x)` becomes `x`): `src/features/chat/a.ts`,',
      '  `src/features/chat/b.ts` and `c.ts`',
      '- Modify (peer): the `package.json` of each package',
      '- Rules: (docs/code/style.md § Errors), `src/features/chat/read.ts`',
    ].join('\n');

    // When
    const plan = parsePlan(text, TOP_LEVEL, NO_BRANCHES);

    // Then
    assert.deepEqual(
      plan.declared.map(file => `${file.verb} ${file.path}`),
      ['Modify src/features/chat/a.ts', 'Modify src/features/chat/b.ts', 'Modify src/features/chat/c.ts', 'Modify package.json'],
    );
    assert.deepEqual(
      plan.paths.map(item => item.path),
      ['src/features/chat/read.ts'],
    );
  });

  it('As a plan reviewer, I check a plan that defines names in code and signatures and get only those as defined', () => {
    // Given
    const text = [
      '```ts',
      'type Made<TValue> = {',
      '  size?: number;',
      '};',
      'export function build() {}',
      'run(task);',
      '```',
      '',
      '**Interfaces:**',
      '',
      '- Produces: `createX(params): Missing`, `Observable<Other>`, `INITIAL: Snapshot`, and `Source<T>` = `{ get(): T }`.',
    ].join('\n');

    // When
    const plan = parsePlan(text, TOP_LEVEL, NO_BRANCHES);

    // Then
    assert.deepEqual([...plan.defined.keys()].sort(), [
      'INITIAL',
      'Made',
      'Source',
      'T',
      'TValue',
      'build',
      'createX',
      'run',
      'size',
    ]);
    assert.deepEqual(
      [...new Set(plan.typeNames.map(type => type.name))],
      ['Made', 'TValue', 'Missing', 'Observable', 'Other', 'Snapshot', 'Source'],
    );
  });

  it('As a plan reviewer, I check a citation that a line break splits and get it whole, on the line it starts', () => {
    // Given
    const text = ['- Rules: (docs/code/style.md § Throw errors, catch at the', '  boundary).'].join('\n');

    // When
    const plan = parsePlan(text, TOP_LEVEL, NO_BRANCHES);

    // Then
    assert.deepEqual(plan.citations, [
      { line: 1, task: 'preamble', file: 'docs/code/style.md', heading: 'Throw errors, catch at the boundary' },
    ]);
  });
});

describe('checkPlanNames', () => {
  it('As a plan reviewer, I check a plan whose files are wrong and get each one as not found', () => {
    // Given
    const text = [
      '### Task 1: Files',
      '',
      '- Modify: `src/features/chat/missing.ts`',
      '- Create: `src/features/chat/present.ts`',
      '- Read: `src/features/chat/present.ts`',
    ].join('\n');

    // When
    const report = check(text, { 'src/features/chat/present.ts': '' });

    // Then
    assert.deepEqual(
      report.notFound.map(item => item.text),
      [
        'Modify `src/features/chat/missing.ts` exists neither at the base commit nor at HEAD, and no earlier task creates it.',
        'Create `src/features/chat/present.ts` already exists at the base commit.',
      ],
    );
  });

  it('As a plan reviewer, I check a plan that modifies a file an earlier task creates and it is found as added by the plan', () => {
    // Given
    const text = [
      '### Task 1: Add',
      '',
      '- Create: `src/features/chat/added.ts`',
      '- Read: `src/features/chat/base.ts`: `base`',
      '',
      '### Task 2: Use',
      '',
      '- Modify: `src/features/chat/added.ts`',
      '- Read: `src/features/chat/base.ts`: `base`',
    ].join('\n');

    // When
    const report = check(text, { 'src/features/chat/base.ts': 'export const base = 1;' });

    // Then
    assert.deepEqual(report.notFound, []);
    assert.equal(report.found.addedByPlan, 2);
  });

  it('As a plan reviewer, I check Read symbols and get each as found in the entry, added by the plan, found elsewhere or not found', () => {
    // Given
    const text = [
      '### Task 1: Symbols',
      '',
      '- Modify: `src/features/chat/a.ts`',
      '- Read: `src/features/chat/a.ts`: `inA`, `inB` in `b.ts`, `planned`, `inOther`, `nowhere`.',
      '',
      '```ts',
      'export function planned() {}',
      '```',
    ].join('\n');
    const files = {
      'src/features/chat/a.ts': 'export const inA = 1;',
      'src/features/chat/b.ts': 'export const inB = 2;',
      'src/shared/utils/other.ts': 'export const inOther = 3;',
    };

    // When
    const report = check(text, files);

    // Then
    assert.equal(report.found.symbols, 2);
    assert.equal(report.found.addedByPlan, 1);
    assert.deepEqual(
      report.foundElsewhere.map(item => item.text),
      [
        '`inOther`, in the entry at line 4, is a word in none of the files it names (`src/features/chat/a.ts`, `src/features/chat/b.ts`). It is in `src/shared/utils/other.ts`.',
      ],
    );
    assert.deepEqual(
      report.notFound.map(item => item.text),
      [
        '`nowhere`, in the entry at line 4, is a word in no tracked file at the base commit or HEAD, and the plan does not define it.',
      ],
    );
  });

  it('As a plan reviewer, I check bare file names written relative to another folder and they resolve to every tracked file of that name', () => {
    // Given
    const text = [
      '### Task 1: Bare names',
      '',
      '- Create: `src/shared/components/added.ts`, `src/shared/components/added.spec.ts`',
      '- Modify: `src/shared/components/useTab.ts`, `partials/formatTime.ts`, `partials/missing.ts`',
      '- Read: `createNotices.ts` (`createNotices`, `clear`). `added.ts` (`brandNew`).',
    ].join('\n');
    const files = {
      'src/shared/components/useTab.ts': '',
      'src/shared/components/partials/formatTime.ts': '',
      'src/shared/components/partials/state/createNotices.ts': 'export function createNotices() { const clear = () => {}; }',
    };

    // When
    const report = check(text, files);

    // Then
    assert.equal(report.found.symbols, 2);
    assert.deepEqual(
      report.notFound.map(item => item.text),
      [
        'Modify `partials/missing.ts` matches no tracked file name, and no earlier task creates it.',
        '`brandNew`, in the entry at line 5, is a word in no tracked file at the base commit or HEAD, and the plan does not define it.',
      ],
    );
  });

  it('As a plan reviewer, I check a plan that names ignored files and get the one on disk as found and the other as not on disk', () => {
    // Given
    const text = [
      '### Task 1: Docs',
      '',
      '- Modify: `src/features/chat/a.ts`',
      '- Read: `docs/_plans/x-design.md`, `docs/_plans/gone-design.md`',
    ].join('\n');
    const disk = createFakeDisk({ 'docs/_plans/x-design.md': true, 'docs/_plans/gone-design.md': false });

    // When
    const report = check(text, { 'src/features/chat/a.ts': '' }, disk);

    // Then
    assert.deepEqual(
      report.notFound.map(item => item.text),
      ['`docs/_plans/gone-design.md` is ignored by git and is not on disk, and no task creates it.'],
    );
  });

  it('As a plan reviewer, I check citations of a heading, a label line and a quoted rule, and only the missing heading is not found', () => {
    // Given
    const text = [
      '### Task 1: Rules',
      '',
      '- Modify: `src/features/chat/a.ts`',
      '- Read: `src/features/chat/a.ts`',
      '- Rules: (docs/code/style.md § Errors: "never match messages"), (docs/code/style.md § Code style, Tests:),',
      '  (docs/code/style.md § No such heading).',
    ].join('\n');
    const files = {
      'src/features/chat/a.ts': '',
      'docs/code/style.md': ['# Style', '', '## Errors', '', '## Code style', '', 'Tests:', ''].join('\n'),
    };

    // When
    const report = check(text, files);

    // Then
    assert.equal(report.found.citations, 2);
    assert.deepEqual(
      report.notFound.map(item => item.text),
      ['`docs/code/style.md` has no heading or label line that "No such heading" starts with, at HEAD.'],
    );
  });

  it('As a plan reviewer, I check citations of headings that end in a parenthetical, cited whole or by the text before it', () => {
    // Given
    const text = [
      '### Task 1: Rules',
      '',
      '- Modify: `src/a.ts`',
      '- Read: `src/a.ts`',
      '- Rules: (docs/code/code-placement.md § Which file (per layer)?), (docs/claude/code-checklist.md § Hygiene),',
      '  (docs/claude/code-checklist.md § Complexity — braid & blast radius).',
    ].join('\n');
    const files = {
      'src/a.ts': '',
      'docs/code/code-placement.md': ['# Placement', '', '## Which file (per layer)?', ''].join('\n'),
      'docs/claude/code-checklist.md': [
        '# Checklist',
        '',
        '## Hygiene (`style.md`)',
        '',
        '## Complexity — braid & blast radius (`docs/abstract/simple-vs-easy.md`)',
        '',
      ].join('\n'),
    };

    // When
    const report = check(text, files);

    // Then
    assert.equal(report.found.citations, 3);
    assert.deepEqual(report.notFound, []);
  });

  it('As a plan reviewer, I check a task with no Read entry and get it as not found', () => {
    // Given
    const text = ['### Task 1: Bare', '', '- Modify: `src/features/chat/a.ts`'].join('\n');

    // When
    const report = check(text, { 'src/features/chat/a.ts': '' });

    // Then
    assert.deepEqual(
      report.notFound.map(item => `${String(item.line)} ${item.text}`),
      ['1 Task 1 has no Read entry.'],
    );
  });

  it('As a plan reviewer, I check the type names a plan uses and only the one nothing provides is not found', () => {
    // Given
    const text = [
      '### Task 1: Types',
      '',
      '- Modify: `src/features/chat/a.ts`',
      '- Read: `src/features/chat/a.ts`',
      '- Only `BehaviorSubject` MAY be imported from `rxjs`. Both derive from `emitter`.',
      '',
      '```ts',
      "import { firstValueFrom } from 'rxjs';",
      'type Made = Promise<Tracked>;',
      '```',
      '',
      '**Interfaces:**',
      '',
      '- Produces: `createX(store: BehaviorSubject<Made>): TabSnapshot`',
    ].join('\n');

    // When
    const report = check(text, { 'src/features/chat/a.ts': 'type Tracked = 1;' });

    // Then
    assert.deepEqual(
      report.notFound.map(item => item.text),
      [
        '`TabSnapshot`, a type name the plan uses, is a word in no tracked file at the base commit or HEAD and no TypeScript built-in, the plan does not define it, and the plan names no package it comes from.',
      ],
    );
    assert.deepEqual(
      report.skipped.map(item => `${item.token} is ${item.reason}`),
      ['BehaviorSubject is from `rxjs`, as the plan says'],
    );
  });

  it('As a plan reviewer, I check a Read symbol only the plan defines and get it with the line that defines it', () => {
    // Given
    const text = [
      '### Task 1: Add',
      '',
      '- Create: `src/features/chat/b.ts`',
      '- Read: `src/features/chat/a.ts`: `added`, `x`',
      '',
      '**Interfaces:**',
      '',
      '- Produces: `added(): void`',
    ].join('\n');

    // When
    const report = check(text, { 'src/features/chat/a.ts': '' });

    // Then
    assert.deepEqual(
      report.definedByPlan.map(item => item.text),
      ['`added`, in the entry at line 4, is a word in none of the files it names. The plan defines it at line 8.'],
    );
    assert.deepEqual(
      report.skipped.map(item => `${item.token} is ${item.reason}`),
      ['x is a one-letter name, read as a placeholder'],
    );
  });

  it('As a plan reviewer, I check the names tasks break and get the users no task up to the breaking one declares', () => {
    // Given
    const text = [
      '### Task 1: Retype',
      '',
      '- Modify: `src/shared/utils/tabState.ts`, `src/features/chat/one.ts`',
      '- Breaks: `TabState.set`',
      '- Read: `src/shared/utils/tabState.ts`',
      '',
      '### Task 2: Drop',
      '',
      '- Delete: `src/shared/utils/makeTab.ts`, `src/shared/utils/useTab.ts`',
      '- Create: `src/aggregates/browser-tabs/useTab.ts`',
      '- Read: `src/shared/utils/tabState.ts`',
      '',
      '### Task 3: Later',
      '',
      '- Modify: `src/features/chat/two.ts`',
      '- Read: `src/shared/utils/tabState.ts`',
    ].join('\n');
    const files = {
      'src/shared/utils/tabState.ts': 'export type TabState = {};',
      'src/shared/utils/makeTab.ts': 'export function makeTab() {}',
      'src/shared/utils/useTab.ts': 'export function useTab() {}',
      'src/features/chat/one.ts': 'TabState makeTab useTab',
      'src/features/chat/two.ts': 'TabState makeTab',
      'src/features/chat/three.ts': 'makeTab',
    };

    // When
    const report = check(text, files);

    // Then
    assert.deepEqual(
      report.notFound.map(item => item.text),
      [
        'Task 1 breaks `TabState`. `TabState` is a word at HEAD in 1 file only a later task declares: `src/features/chat/two.ts` (Task 3).',
        'Task 2 deletes `src/shared/utils/makeTab.ts`. `makeTab` is a word at HEAD in 1 file no task declares: `src/features/chat/three.ts`. It is also in 1 file only a later task declares: `src/features/chat/two.ts` (Task 3).',
      ],
    );
  });

  it('As a plan reviewer, I check a plan that names one missing path twice and get one entry with both lines', () => {
    // Given
    const text = [
      '### Task 1: Twice',
      '',
      '- Modify: `src/features/chat/a.ts`',
      '- Read: `src/features/chat/a.ts`, `src/features/chat/gone.ts`',
      '- See `src/features/chat/gone.ts` again.',
    ].join('\n');

    // When
    const report = check(text, { 'src/features/chat/a.ts': '' });

    // Then
    assert.deepEqual(
      report.notFound.map(item => [item.line, item.also]),
      [[4, [5]]],
    );
  });
});

describe('formatReport', () => {
  it('As a plan reviewer, I read a report and get its commits, its result line and every section in a fixed order', () => {
    // Given
    const report = check(
      ['### Task 1: One', '', '- Modify: `src/features/chat/a.ts`', '- Read: `src/features/chat/a.ts`'].join('\n'),
      {
        'src/features/chat/a.ts': '',
      },
    );

    // When
    const text = formatReport(report, { plan: 'docs/_plans/x-plan.md', base: 'aaaa', head: 'bbbb' });

    // Then
    assert.match(text, /^- Base commit: `aaaa`\. HEAD: `bbbb`\./m);
    assert.match(text, /^- Result: 0 not found, 0 found elsewhere, 2 found\.$/m);
    assert.deepEqual(
      text.split('\n').filter(line => line.startsWith('## ')),
      ['## Not found (0)', '## Found elsewhere (0)', '## Defined by the plan (0)', '## Found (2)', '## Not checked (0)'],
    );
  });
});
