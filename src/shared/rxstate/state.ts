import { type InteropObservable, type Observable, BehaviorSubject, distinctUntilChanged } from 'rxjs';

export type RxState<T> = InteropObservable<T> & {
  value$: Observable<T>;
  set(value: T | ((prev: T) => T)): Observable<T>;
  getInitial(): T;
  pipe: Observable<T>['pipe'];
  get(): T;
};

export function createState<T>(initial: T, comparator?: (a: T, b: T) => boolean): RxState<T> {
  const state$ = new BehaviorSubject(initial);
  const derived$ = state$.pipe(distinctUntilChanged(comparator));

  return {
    value$: derived$,
    pipe: derived$.pipe.bind(derived$),
    get: () => state$.value,
    set(value) {
      if (value instanceof Function) {
        state$.next(value(state$.value));
      } else {
        state$.next(value);
      }

      return derived$;
    },
    getInitial() {
      return initial;
    },
    [Symbol.observable]() {
      return derived$;
    },
  };
}
