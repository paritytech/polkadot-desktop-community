import { type Observable, type ObservableInput, combineLatest, distinctUntilChanged, map, shareReplay } from 'rxjs';

type InferObservableInputValue<T> = T extends ObservableInput<infer V> ? V : never;
type UnwrapObservablesArgs<Args extends unknown[]> = Args extends [infer Head, ...infer Tail]
  ? [InferObservableInputValue<Head>, ...UnwrapObservablesArgs<Tail>]
  : [];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function combine<const Args extends ObservableInput<any>[], R>(
  observables: Args,
  fn: (args: UnwrapObservablesArgs<Args>) => R,
  compare?: (a: R, b: R) => boolean,
): Observable<R> {
  return combineLatest(observables).pipe(
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    map(args => fn(args as never as UnwrapObservablesArgs<Args>)),
    shareReplay(),
    distinctUntilChanged(compare),
  );
}
