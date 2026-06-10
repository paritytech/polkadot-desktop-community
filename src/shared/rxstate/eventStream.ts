import { Subject } from 'rxjs';

export type RxEventStream<T = void> = {
  readonly event$: Subject<T>;
  emit(value: T): void;
};

export function createEventStream<T = void>(): RxEventStream<T> {
  const stream$ = new Subject<T>();

  return {
    event$: stream$,
    emit(value: T) {
      stream$.next(value);
    },
  };
}
