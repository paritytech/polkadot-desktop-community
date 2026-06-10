import { type HexString } from '@/shared/types';

import { type Icon, type ProductExecutables } from './manifest/types';

// Canonical product struct — the post-resolution view produced by the dotNS
// manifest resolver. Pure domain data: no UI/layout concerns leak in.
export type Product = {
  baseName: string;
  displayName: string;
  description: string;
  icon: Icon;
  executables: ProductExecutables;
  owner?: HexString;
};
