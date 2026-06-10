import { type Table, liveQuery } from 'dexie';
import { Observable, from } from 'rxjs';

// liveQuery → Observable bridge. Replaces the per-database `stream$` helper that
// `@/shared/dexie`'s `createDexieStorage` used to provide.
export function streamQuery<T>(read: () => Promise<T>): Observable<T> {
  return new Observable<T>(subscriber => {
    const subscription = from(liveQuery(read)).subscribe({
      next: value => subscriber.next(value),
      error: error => subscriber.error(error),
    });

    return () => subscription.unsubscribe();
  });
}

// Convenience for the common "observe a query over one table" shape.
export function streamTable<Item, T>(table: Table<Item, string>, read: (table: Table<Item, string>) => Promise<T>) {
  return streamQuery(() => read(table));
}
