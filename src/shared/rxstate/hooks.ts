import { useObservable, useObservableEvent } from 'react-rx';
import { type Observable, map, tap } from 'rxjs';

import { type RxEvent } from './event';
import { type RxState } from './state';

export function useRxState<T>(state: RxState<T>) {
  const value = useObservable(state.value$, state.getInitial);

  return [value, state.set] as const;
}

export function useRxEvent<T, R = T>(event: RxEvent<T>, transform?: (value: Observable<R>) => Observable<T>) {
  return useObservableEvent<R, T>(value$ => {
    if (transform) {
      return transform(value$).pipe(tap(event));
    }
    return value$.pipe(
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      map(x => x as unknown as T),
      tap(event),
    );
  });
}
