import { type ProductExecutables } from '@/domains/product';

// The interactable surface to open for a product, decided from its resolved
// executables plus whether a chat room already exists for it. Pure so the
// precedence rules are unit-testable without React/router/resolve plumbing.
export type ProductSurface = { kind: 'app' } | { kind: 'chat'; sessionId: string } | { kind: 'none' };

// Precedence:
//   1. An app executable → open the app.
//   2. A worker that serves chat AND an existing room → open that room.
//   3. Otherwise nothing is interactable.
// Existence of the product is enough to render its icon; this only runs on press.
export function pickProductSurface(executables: ProductExecutables, firstRoom: { sessionId: string } | null): ProductSurface {
  if (executables.app) return { kind: 'app' };
  if (executables.worker?.includes?.chat === true && firstRoom) return { kind: 'chat', sessionId: firstRoom.sessionId };
  return { kind: 'none' };
}
