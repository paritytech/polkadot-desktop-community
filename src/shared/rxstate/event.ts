import { Subject } from 'rxjs';

export type RxEvent<T> = Subject<T> & ((value: T) => RxEvent<T>);

export function createEvent<T>(): RxEvent<T> {
  const stream$ = new Subject<T>();

  const event: RxEvent<T> = Object.assign(stream$, (v: T) => {
    stream$.next(v);
    return event;
  });

  return event;
}
