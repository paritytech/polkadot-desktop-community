import { EXECUTABLE_KINDS } from './manifest/constants';
import { type Product } from './types';

// Stateless predicates on a loaded Product. Display-name / label formatting is
// a dotNS-name string transform and lives in `dotNsService` (toDisplayName /
// toShortLabel), not here.
function hasWidget(product: Product): boolean {
  return product.executables.widget !== undefined;
}

function hasApp(product: Product): boolean {
  return product.executables.app !== undefined;
}

// The product-search rule shared by every list that filters products by user
// input (browser new-tab search, settings apps list): substring match on the
// display name or the `.dot` address, case-insensitive.
function matchesQuery(product: Product, query: string): boolean {
  const q = query.toLowerCase();
  return product.displayName.toLowerCase().includes(q) || product.baseName.toLowerCase().includes(q);
}

// Every identifier a refresh request targets for a product: its own id plus the
// dotNS identifier of each present executable. The producer (clear-cache) fans
// out to each; the consumer (widget body) checks membership — both derive the
// set here rather than restating the loop.
function refreshTargetIdentifiers(productId: string, product: Nullable<Product>): Set<string> {
  const executableIds = product
    ? EXECUTABLE_KINDS.map(kind => product.executables[kind]?.identifier).filter((id): id is string => id !== undefined)
    : [];
  return new Set([productId, ...executableIds]);
}

export const productService = {
  hasWidget,
  hasApp,
  matchesQuery,
  refreshTargetIdentifiers,
};
