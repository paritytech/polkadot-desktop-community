import * as v from 'valibot';

import { type HexString } from '@/shared/types';
import { dotNsService } from '../../dotns/service';
import { type Product } from '../types';

import { type ExecutableKind } from './constants';
import {
  type ExecutableManifest,
  type RenderableIconFormat,
  type RootManifest,
  RENDERABLE_ICON_FORMATS,
  executableManifestSchema,
  rootManifestSchema,
} from './schemas';
import { type Executable, type ProductExecutables } from './types';

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

export const manifestService = {
  parseRootManifest,
  parseExecutableManifest,
  isRenderableIconFormat,
  executableFromManifest,
  executablesFromManifests,
  assembleProduct,
};
