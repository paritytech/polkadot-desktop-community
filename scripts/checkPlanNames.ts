// Looks up every name a plan in docs/_plans/ cites, so a plan review pass reads lookup results instead of running one
// search per name. It reads committed trees, the disk only for paths git ignores, and TypeScript's own type names, so
// the same plan, commits and ignored files always give the same report. It reports what it found and judges nothing.
//
// Usage: node scripts/checkPlanNames.ts <plan> [--base <rev>]
//
// `--base` is the commit the plan's implementation starts from, HEAD by default. A Create path must be absent there.
// Every other lookup passes when the name is found at the base commit or at HEAD, so a plan amended mid-implementation
// still checks against the code its earlier tasks committed. The users of a name a task breaks are looked up at HEAD,
// the code the remaining tasks change.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname as pathDirname, join } from 'node:path';

type Location = { line: number; task: string };

type Named = Location & { name: string };

type DeclaredFile = Location & {
  verb: string;
  path: string;
  /** The file name as written, when the line gives it without a repo path. */
  bareName?: string | undefined;
};

type ReadEntry = Location & {
  /** The repo paths of files the entry names. */
  files: string[];
  /** The file names the entry names without a repo path, such as `resource.ts` or `partials/MessageText.tsx`. */
  bareNames: string[];
  symbols: Named[];
};

type Skipped = Location & { token: string; reason: string };

export type PlanNames = {
  /** The files of each `- Create|Modify|Test|Delete|Rename|Move:` bullet, in plan order. */
  declared: DeclaredFile[];
  /** Every other backticked repo path. */
  paths: (Location & { path: string })[];
  /** Each Read or Precedent entry of a task's Context. */
  reads: ReadEntry[];
  /** Each `(<file>.md § <heading>)` citation. */
  citations: (Location & { file: string; heading: string })[];
  /** Names not looked up: patterns, such as a glob or a placeholder, branch names and one-letter symbols. */
  skipped: Skipped[];
  /** The names the plan defines, with the line of the first definition. */
  defined: Map<string, number>;
  /** The type names, such as `ChatSession`, that the plan's code and its Interfaces and Produces lines use. */
  typeNames: Named[];
  /** The names the plan takes from an npm package, with the package. */
  imported: Map<string, string>;
  /** The exported names each task removes, renames or retypes, from its Breaks lines and its deleted modules. */
  breaks: (Named & { deleted?: string | undefined })[];
  /** Each task heading, with whether the task has a Read entry. */
  tasks: (Location & { hasRead: boolean })[];
};

/** The working tree, read only for paths git ignores, such as plans and reviews. */
export type Disk = {
  /** Whether git ignores the path. Never throws. */
  isIgnored(path: string): boolean;
  /** Whether the path is a file or folder on disk. Never throws. */
  exists(path: string): boolean;
};

/** One committed tree of the repo. */
export type Tree = {
  /** Whether the path is a file or a folder in the tree. Never throws. */
  hasPath(path: string): boolean;
  /** The file's text, or `undefined` when the tree has no such file. Throws when git fails. */
  readFile(path: string): string | undefined;
  /** The files that hold the word, sorted. Throws when git fails. */
  listFilesWithWord(word: string): string[];
  /** The files whose path ends with `/<name>`, sorted. Never throws. */
  listFilesNamed(name: string): string[];
};

type Entry = Location & { text: string; also: number[] };

export type Report = {
  notFound: Entry[];
  foundElsewhere: Entry[];
  /** The Read symbols found only because the plan defines them, which a reviewer checks a task really adds. */
  definedByPlan: Entry[];
  found: { paths: number; symbols: number; typeNames: number; citations: number; breaks: number; addedByPlan: number };
  skipped: Skipped[];
};

const IDENT = '[A-Za-z_$][\\w$]*';

const IS_IDENT = new RegExp(`^${IDENT}$`);

const FILE_NAME = /^[\w.@/-]+\.(ts|tsx|mts|cts|js|mjs|cjs|jsx|json|md|css|astro|html|yml|yaml|toml|svg|txt|sh)$/;

const CODE_FILE = /\.(ts|tsx|mts|cts|js|mjs|cjs|jsx)$/;

const SYMBOL = new RegExp(`^${IDENT}(?:\\.${IDENT})*(?:\\(\\))?$`);

const NOT_A_SYMBOL = new Set(['true', 'false', 'null', 'undefined', 'void', 'this', 'new', 'typeof', 'async', 'await']);

const PATH = /^[\w.@-]+(?:\/[\w.@-]+)+$/;

const PATTERN = /[*{}<>$\s]/;

const HEADING = /^#{1,6}\s+(.*?)\s*#*\s*$/;

const TASK_HEADING = /^#{2,6}\s+Task\s+([\w.-]+)/;

const LABEL_LINE = /^([A-Z][^#*\-`].{0,60}):\s*$/;

const CITATION = /\(([\w./-]+\.md) § ([^)]+)\)/g;

// One bullet kind per line: a declared file list, whose label may hold code with parentheses, as in
// "Modify (script, `f(x)` becomes `x`):", a Read or Precedent entry, or a Breaks line.
const OPENER =
  /^(\s*)- (?:(Create|Modify|Test|Delete|Rename|Move)(?: \((?:[^()`]|`[^`]*`|\([^()]*\))*\))?:|(?:\*\*)?(Read|Precedent|Breaks)(?:\*\*)?:)/;

const CODE_LANGUAGES = new Set(['ts', 'tsx', 'js', 'jsx', 'mjs', 'typescript', 'javascript']);

// A type name starts with a capital and holds a lowercase letter, so a generic parameter such as `T` or a constant
// such as `MAX_SIZE` is not one.
const TYPE_NAME = /(?<![\w$.])[A-Z][A-Za-z0-9]*[a-z][A-Za-z0-9]*(?![\w$])/g;

// Code that starts with the name it defines, as in `createX(params): X`, `size?: number`, `Source<T> = ...` or
// `class X extends Y {`. A bare name or a generic such as `Observable<X>` defines nothing.
const DEFINED_FIRST = new RegExp(
  `^(?:(?:export|default|async|readonly|static|get|set|function|const|let|var|type|interface|class|enum|namespace)\\s+)*(?:${IDENT}\\.)*(${IDENT})\\??(?:<([^>]*)>)?(?:\\(|\\s*[:=](?![:=>])|\\s+(?:\\{|extends\\b|implements\\b))`,
);

const IMPORT = /^\s*import\s+(?:type\s+)?(.*?)\s+from\s+['"]([^'"]+)['"]/;

// A line that says where its names come from, as in "`Observable` from `rxjs`".
const FROM_PACKAGE = /\bfrom `([^`]+)`/;

/**
 * Splits a plan into the names it cites. `topLevel` holds the repo's top-level entries, which mark a repo path.
 * `branches` holds the branch names, which look like paths and are not checked.
 */
export function parsePlan(text: string, topLevel: ReadonlySet<string>, branches: ReadonlySet<string>): PlanNames {
  const plan: PlanNames = {
    declared: [],
    paths: [],
    reads: [],
    citations: [],
    skipped: [],
    defined: new Map(),
    typeNames: [],
    imported: new Map(),
    breaks: [],
    tasks: [],
  };
  const define = (name: string, generics: string | undefined, line: number): void => {
    for (const each of [name, ...(generics ?? '').split(',').map(item => /\w+/.exec(item)?.[0] ?? '')]) {
      if (each !== '' && !plan.defined.has(each)) {
        plan.defined.set(each, line);
      }
    }
  };
  const defineFirst = (code: string, line: number): void => {
    const first = DEFINED_FIRST.exec(code);
    if (first) {
      define(first[1] ?? '', first[2], line);
    }
  };
  const addTypeNames = (code: string, at: Location): void => {
    for (const match of code.matchAll(TYPE_NAME)) {
      plan.typeNames.push({ ...at, name: match[0] });
    }
  };
  // Prose such as "`X` from `y`" names a package only when the plan's code imports from `y`, so "derive from
  // `emitter`" does not.
  const saidFrom: (readonly [name: string, from: string])[] = [];

  const lines = text.split('\n');
  const labels = labelLines(lines);
  let fence: { isCode: boolean } | undefined;
  let section = '';
  let open:
    | { indent: number; kind: 'declared'; verb: string; first?: string }
    | { indent: number; kind: 'read'; entry: ReadEntry }
    | { indent: number; kind: 'breaks' }
    | undefined;

  lines.forEach((line, index) => {
    const at = { line: index + 1, task: labels[index] ?? '' };
    if (line.trimStart().startsWith('```')) {
      fence = fence ? undefined : { isCode: CODE_LANGUAGES.has(line.trim().slice(3).trim().split(/\s/)[0] ?? '') };
      return;
    }
    if (fence) {
      const imported = IMPORT.exec(line);
      const from = imported?.[2] ?? '';
      // A relative or `@/` alias import names repo code, which the tree lookups cover.
      if (imported && !/^(?:\.|\/|@\/)/.test(from)) {
        const names = [...(imported[1] ?? '').matchAll(new RegExp(IDENT, 'g'))].map(match => match[0]);
        // The package's own name counts too, so a Read entry that names it is not looked up as a symbol.
        for (const name of [from, ...names].filter(item => item !== 'type' && item !== 'as')) {
          plan.imported.set(name, from);
        }
      }
      const code = stripCode(line);
      defineFirst(code.trimStart(), at.line);
      if (fence.isCode) {
        addTypeNames(code, at);
      }
      return;
    }
    if (HEADING.test(line)) {
      section = '';
      open = undefined;
      if (TASK_HEADING.test(line)) {
        plan.tasks.push({ ...at, hasRead: false });
      }
      return;
    }
    const label = /^\*\*([^*]+?):?\*\*/.exec(line);
    if (label) {
      section = (label[1] ?? '').toLowerCase();
      open = undefined;
    }
    // A bullet runs on over its wrapped lines and its deeper bullets, and ends at the next bullet as shallow as it.
    const indent = /^\s*/.exec(line)?.[0].length ?? 0;
    if (open && line.trim() !== '' && (line.trimStart().startsWith('- ') ? indent <= open.indent : indent === 0)) {
      open = undefined;
    }
    const opener = OPENER.exec(line);
    if (opener) {
      const verb = opener[2];
      const kind = opener[3];
      const openIndent = (opener[1] ?? '').length;
      if (verb !== undefined) {
        open = { indent: openIndent, kind: 'declared', verb };
      } else if (kind === 'Breaks') {
        open = { indent: openIndent, kind: 'breaks' };
      } else {
        open = { indent: openIndent, kind: 'read', entry: { ...at, files: [], bareNames: [], symbols: [] } };
        plan.reads.push(open.entry);
        const task = plan.tasks.at(-1);
        if (kind === 'Read' && task?.task === at.task) {
          task.hasRead = true;
        }
      }
    }

    const spans = [...line.matchAll(/`([^`]+)`/g)].map(match => match[1] ?? '');
    const from = FROM_PACKAGE.exec(line)?.[1];
    if (from !== undefined) {
      saidFrom.push(...spans.filter(span => span !== from && IS_IDENT.test(span)).map(span => [span, from] as const));
    }
    if (section === 'interfaces' || /\bProduces:/.test(line)) {
      // A span may define a name, and may wrap onto the next line or be assigned outside its backticks, as in
      // "`Source<T>` = `{ get(): T }`", so each span is read with the rest of its line.
      for (const match of line.matchAll(/`/g)) {
        defineFirst(line.slice(match.index + 1).replace(/`/g, ''), at.line);
      }
      for (const span of spans.filter(item => !FILE_NAME.test(item) && !PATH.test(item))) {
        addTypeNames(stripCode(span), at);
      }
    }

    for (const span of spans) {
      const path = span.replace(/:\d+(?:-\d+)?$/, '').replace(/\/$/, '');
      const isRepoPath = path.includes('/') && topLevel.has(path.split('/')[0] ?? '');
      if (isRepoPath && PATTERN.test(path)) {
        plan.skipped.push({ ...at, token: span, reason: 'a pattern, not a path' });
      } else if (isRepoPath && branches.has(span)) {
        plan.skipped.push({ ...at, token: span, reason: 'a branch name' });
      } else if (isRepoPath && PATH.test(path)) {
        if (open?.kind === 'declared') {
          plan.declared.push({ ...at, verb: open.verb, path });
          open.first ??= path;
        } else {
          plan.paths.push({ ...at, path });
        }
        if (open?.kind === 'read' && FILE_NAME.test(path)) {
          open.entry.files.push(path);
        }
      } else if (FILE_NAME.test(span)) {
        // A declared bullet may list more files by name alone, in the folder of its first path. With no path before
        // it, as in "the `package.json` of each package", the name stands for every file of that name.
        if (open?.kind === 'declared') {
          const path = open.first === undefined ? span : `${dirname(open.first)}/${span}`;
          plan.declared.push({ ...at, verb: open.verb, path, bareName: span });
        } else if (open?.kind === 'read') {
          open.entry.bareNames.push(span);
        }
      } else if (open?.kind === 'breaks' && SYMBOL.test(span)) {
        // Users import the export, so `TabState.set` breaks the users of `TabState`.
        plan.breaks.push({ ...at, name: span.replace(/\(\)$/, '').split('.')[0] ?? '' });
      } else if (open?.kind === 'read' && SYMBOL.test(span)) {
        const name = span.replace(/\(\)$/, '').split('.').pop() ?? '';
        if (name.length === 1) {
          plan.skipped.push({ ...at, token: span, reason: 'a one-letter name, read as a placeholder' });
        } else if (!NOT_A_SYMBOL.has(name)) {
          open.entry.symbols.push({ ...at, name });
        }
      }
    }
  });

  const packages = new Set(plan.imported.values());
  for (const [name, from] of saidFrom) {
    if (packages.has(from) && !plan.imported.has(name)) {
      plan.imported.set(name, from);
    }
  }
  // Deleting a module breaks every file that imports it by its name, unless the plan creates a module of that name.
  const fileName = (path: string): string => path.split('/').pop() ?? '';
  const created = new Set(
    plan.declared.filter(file => file.verb === 'Create' || file.verb === 'Test').map(file => fileName(file.path)),
  );
  for (const file of plan.declared.filter(item => item.verb === 'Delete' && CODE_FILE.test(item.path))) {
    const name = fileName(file.path).replace(CODE_FILE, '');
    if (IS_IDENT.test(name) && !created.has(fileName(file.path))) {
      plan.breaks.push({ line: file.line, task: file.task, name, deleted: file.path });
    }
  }
  plan.breaks.sort((a, b) => a.line - b.line);
  plan.citations = listCitations(text, lines, labels);
  return plan;
}

/**
 * Looks up every name of the plan in the base and HEAD trees, and on disk for a path git ignores. `builtins` holds the
 * type names TypeScript declares itself. Throws when a tree throws.
 */
export function checkPlanNames(plan: PlanNames, base: Tree, head: Tree, disk: Disk, builtins: ReadonlySet<string>): Report {
  const notFound = new Map<string, Entry>();
  const foundElsewhere = new Map<string, Entry>();
  const definedByPlan = new Map<string, Entry>();
  const skipped = [...plan.skipped];
  const found = { paths: 0, symbols: 0, typeNames: 0, citations: 0, breaks: 0, addedByPlan: 0 };
  const add = (map: Map<string, Entry>, at: Location, text: string): void => {
    const entry = map.get(text);
    if (entry) {
      entry.also.push(at.line);
    } else {
      map.set(text, { ...at, text, also: [] });
    }
  };
  const skipImported = (at: Named): boolean => {
    const from = plan.imported.get(at.name);
    if (from !== undefined) {
      skipped.push({ ...at, token: at.name, reason: `from \`${from}\`, as the plan says` });
    }
    return from !== undefined;
  };
  const both = (list: (tree: Tree) => string[]): string[] => [...new Set([...list(base), ...list(head)])].sort();
  const inTrees = (path: string): boolean => base.hasPath(path) || head.hasPath(path);
  const exists = (path: string): boolean => inTrees(path) || (disk.isIgnored(path) && disk.exists(path));
  const missing = (path: string): string =>
    disk.isIgnored(path) ? 'is ignored by git and is not on disk' : 'exists neither at the base commit nor at HEAD';
  const named = (name: string): string[] => both(tree => tree.listFilesNamed(name));
  const creations = plan.declared.filter(file => file.verb === 'Create' || file.verb === 'Test');

  plan.declared.forEach((file, index) => {
    if (file.verb === 'Create') {
      // A bare name with no folder before it gives no path that must be absent.
      if (file.path !== file.bareName && base.hasPath(file.path)) {
        add(notFound, file, `Create \`${file.path}\` already exists at the base commit.`);
      } else {
        found.addedByPlan++;
      }
    } else if (exists(file.path) || (file.bareName !== undefined && named(file.bareName).length > 0)) {
      found.paths++;
    } else if (file.verb === 'Test' || creations.some(item => plan.declared.indexOf(item) < index && item.path === file.path)) {
      found.addedByPlan++;
    } else {
      const fact =
        file.bareName === undefined
          ? `\`${file.path}\` ${missing(file.path)}`
          : `\`${file.bareName}\` matches no tracked file name`;
      add(notFound, file, `${file.verb} ${fact}, and no earlier task creates it.`);
    }
  });

  for (const mention of plan.paths) {
    if (exists(mention.path)) {
      found.paths++;
    } else if (creations.some(file => file.path === mention.path || file.path.startsWith(`${mention.path}/`))) {
      found.addedByPlan++;
    } else {
      add(notFound, mention, `\`${mention.path}\` ${missing(mention.path)}, and no task creates it.`);
    }
  }

  for (const entry of plan.reads) {
    // A bare file name stands for every tracked file of that name, so a symbol in any of them is found.
    const files = [...new Set([...entry.files.filter(inTrees), ...entry.bareNames.flatMap(named)])].sort();
    const where = `in the entry at line ${String(entry.line)}`;
    for (const symbol of entry.symbols) {
      if (files.some(file => hasWord(base.readFile(file), symbol.name) || hasWord(head.readFile(file), symbol.name))) {
        found.symbols++;
        continue;
      }
      if (skipImported(symbol)) {
        continue;
      }
      const definedAt = plan.defined.get(symbol.name);
      if (definedAt !== undefined) {
        found.addedByPlan++;
        const text = `\`${symbol.name}\`, ${where}, is a word in none of the files it names. The plan defines it at line ${String(definedAt)}.`;
        add(definedByPlan, symbol, text);
        continue;
      }
      const elsewhere = both(tree => tree.listFilesWithWord(symbol.name));
      if (elsewhere.length > 0 && files.length === 0) {
        // An entry that names no file it could be in leaves the repo as the only place to look.
        found.symbols++;
      } else if (elsewhere.length > 0) {
        const own = files.length > 0 ? listItems(files.map(quote), 5) : 'none of them is in the repo';
        const text = `\`${symbol.name}\`, ${where}, is a word in none of the files it names (${own}). It is in ${listItems(elsewhere.map(quote), 3)}.`;
        add(foundElsewhere, symbol, text);
      } else {
        const text = `\`${symbol.name}\`, ${where}, is a word in no tracked file at the base commit or HEAD, and the plan does not define it.`;
        add(notFound, symbol, text);
      }
    }
  }

  // Each type name is looked up once, and a missing one is reported on every line that uses it.
  const missingTypes = new Set<string>();
  const checkedTypes = new Set<string>();
  for (const type of plan.typeNames) {
    if (!checkedTypes.has(type.name)) {
      checkedTypes.add(type.name);
      if (skipImported(type)) {
        continue;
      }
      if (plan.defined.has(type.name)) {
        found.addedByPlan++;
      } else if (builtins.has(type.name) || both(tree => tree.listFilesWithWord(type.name)).length > 0) {
        found.typeNames++;
      } else {
        missingTypes.add(type.name);
      }
    }
    if (missingTypes.has(type.name)) {
      const text = `\`${type.name}\`, a type name the plan uses, is a word in no tracked file at the base commit or HEAD and no TypeScript built-in, the plan does not define it, and the plan names no package it comes from.`;
      add(notFound, type, text);
    }
  }

  for (const broken of plan.breaks) {
    const nextTask = plan.tasks.find(task => task.line > broken.line)?.line ?? Infinity;
    const declaring = (file: string): DeclaredFile[] =>
      plan.declared.filter(
        item =>
          item.path === file ||
          file.startsWith(`${item.path}/`) ||
          (item.bareName !== undefined && file.endsWith(`/${item.bareName}`)),
      );
    const users = head.listFilesWithWord(broken.name).filter(file => !declaring(file).some(item => item.line < nextTask));
    if (users.length === 0) {
      found.breaks++;
      continue;
    }
    // Every user left is declared by no task or by a later one only.
    const later = users.flatMap(file =>
      declaring(file)
        .slice(0, 1)
        .map(item => `${quote(file)} (${item.task})`),
    );
    const undeclared = users.filter(file => declaring(file).length === 0).map(quote);
    const count = (items: string[]): string => `${String(items.length)} ${items.length === 1 ? 'file' : 'files'}`;
    const parts = [
      ...(undeclared.length > 0 ? [`${count(undeclared)} no task declares: ${listItems(undeclared, 12)}.`] : []),
      ...(later.length > 0 ? [`${count(later)} only a later task declares: ${listItems(later, 12)}.`] : []),
    ];
    const action = broken.deleted === undefined ? `breaks \`${broken.name}\`` : `deletes \`${broken.deleted}\``;
    add(notFound, broken, `${broken.task} ${action}. \`${broken.name}\` is a word at HEAD in ${parts.join(' It is also in ')}`);
  }

  for (const citation of plan.citations) {
    const content = head.readFile(citation.file) ?? base.readFile(citation.file);
    if (content === undefined) {
      const text = `\`${citation.file}\`, cited as (${citation.file} § ${citation.heading}), exists neither at the base commit nor at HEAD.`;
      add(notFound, citation, text);
    } else if (hasHeading(content, citation.heading)) {
      found.citations++;
    } else {
      const text = `\`${citation.file}\` has no heading or label line that "${citation.heading}" starts with, at HEAD.`;
      add(notFound, citation, text);
    }
  }

  for (const task of plan.tasks.filter(item => !item.hasRead)) {
    add(notFound, task, `${task.task} has no Read entry.`);
  }

  const byLine = (a: Location, b: Location): number => a.line - b.line;
  return {
    notFound: [...notFound.values()].sort(byLine),
    foundElsewhere: [...foundElsewhere.values()].sort(byLine),
    definedByPlan: [...definedByPlan.values()].sort(byLine),
    found,
    skipped: skipped.sort(byLine),
  };
}

/** The report as Markdown. */
export function formatReport(report: Report, meta: { plan: string; base: string; head: string }): string {
  const { paths, symbols, typeNames, citations, breaks, addedByPlan } = report.found;
  const total = paths + symbols + typeNames + citations + breaks + addedByPlan;
  const section = (title: string, items: string[]): string[] => [
    `## ${title} (${String(items.length)})`,
    '',
    ...(items.length > 0 ? items : ['None.']),
    '',
  ];
  const entry = (item: Entry): string => {
    const also = item.also.length > 0 ? ` Also lines ${item.also.join(', ')}.` : '';
    return `- Line ${String(item.line)}, ${item.task}: ${item.text}${also}`;
  };
  return [
    '# Plan names check',
    '',
    `- Plan: \`${meta.plan}\``,
    `- Base commit: \`${meta.base}\`. HEAD: \`${meta.head}\`. The working tree is read only for paths git ignores.`,
    `- Result: ${String(report.notFound.length)} not found, ${String(report.foundElsewhere.length)} found elsewhere, ${String(total)} found.`,
    '',
    'Every line is the result of a lookup by `scripts/checkPlanNames.ts`, not a judgment. What it looks up and how a',
    'plan review pass reads each section is in `.claude/skills/architecture/SKILL.md`, section Names check.',
    '',
    ...section('Not found', report.notFound.map(entry)),
    ...section('Found elsewhere', report.foundElsewhere.map(entry)),
    ...section('Defined by the plan', report.definedByPlan.map(entry)),
    `## Found (${String(total)})`,
    '',
    `- ${String(paths)} paths, ${String(symbols)} Read symbols, ${String(typeNames)} type names and ${String(citations)} citations found at the base commit or HEAD.`,
    `- ${String(breaks)} broken names whose every user at HEAD a task up to the breaking one declares.`,
    `- ${String(addedByPlan)} names the plan itself adds: a Create or Test file, or a name the plan defines.`,
    '',
    ...section(
      'Not checked',
      report.skipped.map(item => `- Line ${String(item.line)}, ${item.task}: \`${item.token}\` is ${item.reason}.`),
    ),
  ].join('\n');
}

/** A committed tree, read through git. Throws when `rev` names no commit. */
export function createGitTree(rev: string): Tree {
  const files = new Set(git(['ls-tree', '-r', '--name-only', '-z', rev]).split('\0').filter(Boolean));
  const folders = new Set(
    [...files].flatMap(file =>
      file
        .split('/')
        .slice(0, -1)
        .map((_, index, parts) => parts.slice(0, index + 1).join('/')),
    ),
  );
  const sorted = [...files].sort();
  const contents = new Map<string, string>();
  return {
    hasPath: path => files.has(path) || folders.has(path),
    listFilesNamed: name => sorted.filter(file => file === name || file.endsWith(`/${name}`)),
    readFile: path => {
      if (!files.has(path)) {
        return undefined;
      }
      const content = contents.get(path) ?? git(['show', `${rev}:${path}`]);
      contents.set(path, content);
      return content;
    },
    listFilesWithWord: word => {
      const result = spawnSync('git', ['grep', '-l', '-w', '-F', '-e', word, rev, '--'], {
        encoding: 'utf8',
        maxBuffer: 1 << 26,
      });
      // git grep exits 1 when nothing matches.
      if (result.status !== 0 && result.status !== 1) {
        throw new Error(`git grep failed: ${result.stderr.trim()}`);
      }
      return result.stdout
        .split('\n')
        .filter(Boolean)
        .map(line => line.slice(rev.length + 1))
        .sort();
    },
  };
}

/** The working tree, for paths git ignores. */
export function createDisk(): Disk {
  return {
    isIgnored: path => spawnSync('git', ['check-ignore', '-q', '--no-index', path]).status === 0,
    exists: path => existsSync(path),
  };
}

/** The type names TypeScript declares in its own libraries. Throws when TypeScript is not installed. */
export function loadBuiltinTypeNames(): Set<string> {
  const lib = join(pathDirname(createRequire(import.meta.url).resolve('typescript/package.json')), 'lib');
  return new Set(
    readdirSync(lib)
      .filter(name => /^lib\..*\.d\.ts$/.test(name))
      .flatMap(name => [...readFileSync(join(lib, name), 'utf8').matchAll(/\b[A-Z][\w$]*/g)].map(match => match[0])),
  );
}

/** The section each line sits in: its task, else the nearest heading above it at the task headings' level or higher. */
function labelLines(lines: string[]): string[] {
  let label = 'preamble';
  let taskLevel = Infinity;
  let inFence = false;
  return lines.map(line => {
    if (line.trimStart().startsWith('```')) {
      inFence = !inFence;
    }
    const heading = inFence ? null : HEADING.exec(line);
    if (heading) {
      const level = line.indexOf(' ');
      const task = TASK_HEADING.exec(line);
      if (task) {
        label = `Task ${task[1] ?? ''}`;
        taskLevel = level;
      } else if (level <= taskLevel) {
        label = `section "${heading[1] ?? ''}"`;
        taskLevel = Infinity;
      }
    }
    return label;
  });
}

function git(args: string[]): string {
  const result = spawnSync('git', args, { encoding: 'utf8', maxBuffer: 1 << 28 });
  if (result.status !== 0) {
    throw new Error(`git ${args[0] ?? ''} failed: ${result.stderr.trim()}`);
  }
  return result.stdout;
}

function dirname(path: string): string {
  return path.slice(0, path.lastIndexOf('/'));
}

function quote(text: string): string {
  return `\`${text}\``;
}

function listItems(items: string[], max: number): string {
  const more = items.length > max ? ` and ${String(items.length - max)} more` : '';
  return `${items.slice(0, max).join(', ')}${more}`;
}

/** The line without its string literals and comments, so their words are not read as code. */
function stripCode(line: string): string {
  if (/^\s*(?:\*|\/\*)/.test(line)) {
    return '';
  }
  return line
    .replace(/'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`/g, "''")
    .replace(/\/\/.*$/, '')
    .replace(/\/\*.*?\*\//g, '');
}

function hasWord(text: string | undefined, word: string): boolean {
  return text !== undefined && new RegExp(`(?<![\\w$])${word.replace(/\$/g, '\\$')}(?![\\w$])`).test(text);
}

function hasHeading(content: string, cited: string): boolean {
  const clean = (heading: string): string => heading.replace(/`/g, '').replace(/:$/, '').trim();
  // A label line, such as "Tests:" alone on its line, is a section a citation may point at too. A heading that ends in a
  // parenthetical, such as "Hygiene (`style.md`)" or "Which file (per layer)?", is also cited by the text before it,
  // since a citation ends at its first ")".
  const targets = new Set(
    content
      .split('\n')
      .flatMap(line => HEADING.exec(line)?.[1] ?? LABEL_LINE.exec(line)?.[1] ?? [])
      .map(clean)
      .flatMap(heading => [heading, clean(heading.split(' (')[0] ?? '')]),
  );
  // A citation may add text after its target, as in "§ Code style, Tests:" or "§ Errors: \"quoted rule\"", and a target
  // may hold a comma or a colon itself, so every prefix that ends before one of those marks is a candidate.
  const ends = [...cited.matchAll(/[,:]| "| \(/g)].map(mark => mark.index);
  return [cited, ...ends.map(end => cited.slice(0, end))].map(clean).some(item => item !== '' && targets.has(item));
}

function listCitations(text: string, lines: string[], labels: string[]): PlanNames['citations'] {
  // Blank fenced code and join wrapped lines without moving any offset, so an offset still maps to its line.
  let inFence = false;
  const flat = lines
    .map(line => {
      const isFence = line.trimStart().startsWith('```');
      const blank = inFence || isFence;
      inFence = isFence ? !inFence : inFence;
      return blank ? ' '.repeat(line.length) : line;
    })
    .join(' ');
  return [...flat.matchAll(CITATION)].map(match => {
    const line = text.slice(0, match.index).split('\n').length;
    const heading = (match[2] ?? '').replace(/\s+/g, ' ').trim();
    return { line, task: labels[line - 1] ?? '', file: match[1] ?? '', heading };
  });
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const baseFlag = args.indexOf('--base');
  const baseRev = baseFlag >= 0 ? args[baseFlag + 1] : 'HEAD';
  const positional = args.filter((arg, index) => !arg.startsWith('--') && !(baseFlag >= 0 && index === baseFlag + 1));
  const planPath = positional[0];
  if (
    planPath === undefined ||
    positional.length > 1 ||
    baseRev === undefined ||
    baseRev.startsWith('--') ||
    args.some(arg => arg.startsWith('--') && arg !== '--base')
  ) {
    console.error('Usage: node scripts/checkPlanNames.ts <plan> [--base <rev>]');
    process.exit(1);
  }
  try {
    const base = git(['rev-parse', '--verify', `${baseRev}^{commit}`]).trim();
    const head = git(['rev-parse', '--verify', 'HEAD^{commit}']).trim();
    const baseTree = createGitTree(base);
    const headTree = head === base ? baseTree : createGitTree(head);
    const topLevel = new Set([base, head].flatMap(rev => git(['ls-tree', '--name-only', rev]).split('\n')).filter(Boolean));
    const refs = git(['for-each-ref', '--format=%(refname:lstrip=2)', 'refs/heads', 'refs/remotes']).split('\n');
    // A remote branch is also named without its remote, as in `main` for `origin/main`.
    const branches = new Set(refs.filter(Boolean).flatMap(name => [name, name.slice(name.indexOf('/') + 1)]));
    const plan = parsePlan(readFileSync(planPath, 'utf8'), topLevel, branches);
    if (plan.declared.length === 0) {
      throw new Error('found no "- Create|Modify|Test|Delete|Rename|Move:" bullet, so the plan does not follow the plan format');
    }
    const report = checkPlanNames(plan, baseTree, headTree, createDisk(), loadBuiltinTypeNames());
    process.stdout.write(formatReport(report, { plan: planPath, base: base.slice(0, 12), head: head.slice(0, 12) }));
  } catch (error) {
    console.error(`checkPlanNames: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
