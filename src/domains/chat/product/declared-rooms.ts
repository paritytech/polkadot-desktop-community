import { BehaviorSubject, map } from 'rxjs';

export type DeclaredProductRoom = {
  productId: string;
  roomId: string;
};

type Registry = Map<string, Map<string, DeclaredProductRoom>>;

const registry$ = new BehaviorSubject<Registry>(new Map());

function toSnapshot(registry: Registry): DeclaredProductRoom[] {
  const rooms: DeclaredProductRoom[] = [];
  for (const productRooms of registry.values()) {
    rooms.push(...productRooms.values());
  }
  return rooms;
}

export const declaredProductRooms$ = registry$.pipe(map(toSnapshot));

export function registerDeclaredProductRoom(params: { productId: string; roomId: string }): 'New' | 'Exists' {
  const registry = new Map(registry$.value);
  const productRooms = new Map(registry.get(params.productId));

  if (productRooms.has(params.roomId)) {
    return 'Exists';
  }

  productRooms.set(params.roomId, { productId: params.productId, roomId: params.roomId });
  registry.set(params.productId, productRooms);
  registry$.next(registry);
  return 'New';
}

export function getDeclaredProductRooms(productId: string): DeclaredProductRoom[] {
  return [...(registry$.value.get(productId)?.values() ?? [])];
}

// Drops a product's declared rooms — called when its worker is disposed, so the
// in-memory registry mirrors only currently-running workers and never grows unbounded.
export function clearDeclaredProductRooms(productId: string): void {
  if (!registry$.value.has(productId)) return;

  const registry = new Map(registry$.value);
  registry.delete(productId);
  registry$.next(registry);
}
