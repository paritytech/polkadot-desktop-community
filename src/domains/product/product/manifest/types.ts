import { type HexString } from '@/shared/types';
import { type ArchiveContent } from '@/domains/network';

import { type AppManifest, type Icon, type RootManifest, type WidgetManifest, type WorkerManifest } from './schemas';

// Runtime executable shapes — the wire `*Manifest` minus the `$v` version
// marker, plus the resolved `identifier` (the subname the archive lives
// under) and the on-chain `contenthash` read at resolve time.
// Derived from the schema so new fields on a `*Manifest` flow through.

export type AppExecutable = Omit<AppManifest, '$v'> & { identifier: string; contenthash: HexString };
export type WidgetExecutable = Omit<WidgetManifest, '$v'> & { identifier: string; contenthash: HexString };
export type WorkerExecutable = Omit<WorkerManifest, '$v'> & { identifier: string; contenthash: HexString };

export type Executable = AppExecutable | WidgetExecutable | WorkerExecutable;

export type ProductExecutables = {
  app?: AppExecutable;
  widget?: WidgetExecutable;
  worker?: WorkerExecutable;
};

// `origin` is the synthetic `polkadot://<domain>` scheme the renderer uses to
// serve files; `files` is the CAR-unpacked file tree (forward-slash paths).
export type ProductArchive = {
  domain: string;
  origin: string;
  files: ArchiveContent;
};

// A loaded executable archive plus the on-chain `contenthash` it was resolved
// at — the unit returned by the archive gateway / offline-first load use case.
export type ExecutableContent = {
  contenthash: HexString;
  archive: ProductArchive;
};

export type { Icon, RootManifest };
