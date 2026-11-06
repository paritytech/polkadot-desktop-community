import { type ExecutableKind as CoreExecutableKind } from '@parity/truapi-host';
import * as v from 'valibot';

import { type HexString } from '@/shared/types';
import { type ArchiveContent } from '@/domains/network';
import { dotNsService } from '../../dotns/service';
import { type Product } from '../types';

import { type ExecutableKind } from './constants';
import {
  type ExecutableManifest,
  type RenderableIconFormat,
  type RootManifest,
  type SemVer,
  RENDERABLE_ICON_FORMATS,
  executableManifestSchema,
  rootManifestSchema,
} from './schemas';
import { type AppExecutable, type Executable, type ProductExecutables } from './types';

const rootManifestJsonSchema = v.pipe(v.string(), v.parseJson(), rootManifestSchema);
const executableManifestJsonSchema = v.pipe(v.string(), v.parseJson(), executableManifestSchema);

// Returns null on every failure path (empty value, malformed JSON, schema
// mismatch). In product resolution those all collapse to "product is undiscoverable".
function parseRootManifest(rawText: string): RootManifest | null {
  if (!rawText) return null;
  const result = v.safeParse(rootManifestJsonSchema, rawText);
  return result.success ? result.output : null;
}

// Same contract as `parseRootManifest`, plus the kind ↔ subname-label
// match: a manifest read from `worker.<base>` whose `kind` says `'app'` is
// treated as malformed so the product's other executables still load.
function parseExecutableManifest(rawText: string | null, expectedKind: ExecutableKind): ExecutableManifest | null {
  if (!rawText) return null;
  const result = v.safeParse(executableManifestJsonSchema, rawText);
  if (!result.success || result.output.kind !== expectedKind) return null;
  return result.output;
}

// An unknown icon `format` is not a renderable image: the Host
// renders a placeholder instead and the product stays launchable. Callers use
// this to decide whether to decode the icon bytes or fall back to a placeholder.
function isRenderableIconFormat(format: string): format is RenderableIconFormat {
  const normalized = format.toLowerCase();
  return RENDERABLE_ICON_FORMATS.some(known => known === normalized);
}

// Archive paths may be stored with or without a leading slash; try both so a path
// resolved under one convention still matches a file stored under the other.
// Shared by the worker's module loader and the renderer's archive-backed images.
function lookupArchiveFile(files: ArchiveContent, id: string): Uint8Array | undefined {
  return files[id] ?? files[id.replace(/^\//, '')] ?? files[`/${id}`];
}

// The renderer's `Image` node carries no format — only bytes — so the host reads the
// magic number rather than trusting a declaration. The allowlist is deliberately the
// same pair `RENDERABLE_ICON_FORMATS` names and `ipfsService.toDataUrl` accepts; SVG
// is excluded because it is a script-bearing document, and the render tree's whole
// premise is that a product names layouts and tokens but never markup.
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_MAGIC = [0xff, 0xd8, 0xff];

function startsWith(bytes: Uint8Array, magic: number[]): boolean {
  if (bytes.length < magic.length) return false;

  return magic.every((byte, i) => bytes[i] === byte);
}

function sniffImageFormat(bytes: Uint8Array): RenderableIconFormat | null {
  if (startsWith(bytes, PNG_MAGIC)) return 'png';
  if (startsWith(bytes, JPEG_MAGIC)) return 'jpeg';

  return null;
}

function assembleProduct(params: {
  baseName: string;
  root: RootManifest;
  executables: ProductExecutables;
  owner?: HexString;
}): Product {
  const { baseName, root, executables, owner } = params;
  return {
    baseName,
    displayName: root.displayName,
    description: root.description,
    icon: root.icon,
    executables,
    owner,
  };
}

// An app executable built from just a contenthash — the shape used when no
// parseable manifest exists (a legacy pre-manifest product, or an app whose
// manifest won't parse). Only `app` degrades this way: widget/worker need
// manifest-only fields.
function legacyApp(identifier: string, contenthash: HexString): AppExecutable {
  return { kind: 'app', identifier, appVersion: [0, 0, 0], contenthash };
}

function executableFromManifest(baseName: string, manifest: ExecutableManifest, contenthash: HexString): Executable {
  const { $v: _v, ...rest } = manifest;
  // Spread loses the variant link after destructuring; shapes are identical by
  // `Omit<*Manifest, '$v'> & { identifier, contenthash }`, enforced at the type level.

  return { ...rest, identifier: dotNsService.subnameOf(baseName, manifest.kind), contenthash };
}

function executablesFromManifests(
  baseName: string,
  entries: ({ manifest: ExecutableManifest; contenthash: HexString } | null)[],
): ProductExecutables {
  const result: ProductExecutables = {};
  for (const entry of entries) {
    if (!entry) continue;
    const e = executableFromManifest(baseName, entry.manifest, entry.contenthash);
    switch (e.kind) {
      case 'app':
        result.app = e;
        break;
      case 'widget':
        result.widget = e;
        break;
      case 'worker':
        result.worker = e;
        break;
    }
  }
  return result;
}

// Canonical dotted string form of a version value (e.g. [2,1,1] -> "2.1.1",
// [2,1,1,"abc"] -> "2.1.1.abc"). Pure value formatting only — the decision to
// hide a legacy/all-zero version is a presentation concern owned by the feature.
function formatVersion(version: SemVer): string {
  return version.join('.');
}

// The core names the executable kinds a manifest declares in its own casing
// (`ProductContext.executionKind`); host state keyed for the core uses the core's name.
function executionKindOf(kind: ExecutableKind): CoreExecutableKind {
  switch (kind) {
    case 'app':
      return 'App';
    case 'widget':
      return 'Widget';
    case 'worker':
      return 'Worker';
  }
}

export const manifestService = {
  parseRootManifest,
  parseExecutableManifest,
  isRenderableIconFormat,
  lookupArchiveFile,
  sniffImageFormat,
  legacyApp,
  executableFromManifest,
  executablesFromManifests,
  assembleProduct,
  formatVersion,
  executionKindOf,
};
