import { type Observable, distinctUntilChanged, map } from 'rxjs';

import { createState } from '@/shared/rxstate';
import { type ProductWorkerInstance } from '@/domains/product';

const instances$ = createState<Record<string, ProductWorkerInstance>>({});

function register(instance: ProductWorkerInstance): void {
  instances$.set(prev => ({ ...prev, [instance.productId]: instance }));
}

function unregister(instance: ProductWorkerInstance): void {
  instances$.set(prev => {
    if (prev[instance.productId] !== instance) return prev;
    const { [instance.productId]: _, ...rest } = prev;
    return rest;
  });
}

function get(productId: string): ProductWorkerInstance | null {
  return instances$.get()[productId] ?? null;
}

function instance$(productId: string): Observable<ProductWorkerInstance | null> {
  return instances$.pipe(
    map(record => record[productId] ?? null),
    distinctUntilChanged(),
  );
}

export const productWorkerRegistry = {
  instances$,
  register,
  unregister,
  get,
  instance$,
};
