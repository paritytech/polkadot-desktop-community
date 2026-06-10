import { type Observable, distinctUntilChanged, fromEvent, map, merge, of, shareReplay, startWith } from 'rxjs';

const hasDom = typeof window !== 'undefined' && typeof navigator !== 'undefined';

const readOnline = (): boolean => (typeof navigator !== 'undefined' ? navigator.onLine : true);

/**
 * Emits the browser's connectivity state: `true` while online, `false` after an
 * `offline` event, flipping back to `true` on the next `online` event. Seeded
 * synchronously from `navigator.onLine` so first subscribers get an immediate
 * value. Shared (refCount: false) so all consumers observe the same state.
 */
export const online$: Observable<boolean> = hasDom
  ? merge(fromEvent(window, 'online').pipe(map(() => true)), fromEvent(window, 'offline').pipe(map(() => false))).pipe(
      startWith(readOnline()),
      distinctUntilChanged(),
      shareReplay({ bufferSize: 1, refCount: false }),
    )
  : of(true);
