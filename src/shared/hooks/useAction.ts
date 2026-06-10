import { type Result, type ResultAsync, Err, Ok } from 'neverthrow';
import { useCallback, useDebugValue, useEffect, useRef, useState } from 'react';
import { type Observable, defer, from, isObservable, throwIfEmpty } from 'rxjs';
import { map, shareReplay, tap } from 'rxjs/operators';

import { useLooseRef } from './useLooseRef';

export type ActionStatus = 'idle' | 'pending' | 'success' | 'error';
export type ActionMethod<P, T, E = unknown> = (params: P) => Promise<T> | Observable<T> | Result<T, E> | ResultAsync<T, E>;

export type ActionHookValue<P, T, E = unknown> = {
  run: (params: P) => Observable<T>;
  pending: boolean;
  status: ActionStatus;
  data: T | undefined;
  error: E;
  reset: () => void;
};

type State<T> = { status: ActionStatus; data: T | undefined; error: unknown };

const idle = <T>(): State<T> => ({ status: 'idle', data: undefined, error: null });

// neverthrow `Result`/`ResultAsync` are unwrapped transparently: an `Ok` emits
// its value as the action's `data`, while an `Err` is routed through the error
// channel so it lands in `error` and rejects `run` — the same shape a thrown or
// rejected method already produces.
function isNeverthrowResult<T, E>(value: T | Result<T, E>): value is Result<T, E> {
  return value instanceof Ok || value instanceof Err;
}

function unwrapResult<T, E>(result: Result<T, E>): T {
  if (result.isErr()) throw result.error;
  return result.value;
}

/**
 * Imperative action hook. `run(params)` returns an `Observable<T>` that has
 * already been subscribed to internally — the underlying work fires
 * immediately and shareReplays emissions to caller-side subscribers.
 *
 * Fire-and-forget callers can ignore the return value; observers subscribe
 * to track emissions. Unmount does **not** cancel — state updates after
 * unmount are dropped, side effects continue. An observable that completes
 * without emitting is treated as an error.
 */
export function useAction<P, T, E = unknown>(method: ActionMethod<P, T, E>): ActionHookValue<P, T, unknown> {
  const [state, setState] = useState<State<T>>(idle);
  const getMethod = useLooseRef(method);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const safeSet = useCallback((updater: (s: State<T>) => State<T>) => {
    if (mounted.current) setState(updater);
  }, []);

  const run = useCallback(
    (params: P): Observable<T> => {
      const shared$ = defer((): Observable<T | Result<T, E>> => {
        const result = getMethod()(params);
        return isObservable(result) ? result : from(Promise.resolve(result));
      }).pipe(
        map((value): T => (isNeverthrowResult(value) ? unwrapResult(value) : value)),
        throwIfEmpty(() => new Error('Action completed without emitting a value')),
        tap({
          next: (value: T) => safeSet(() => ({ status: 'pending', data: value, error: null })),
          error: (error: unknown) => safeSet(s => ({ status: 'error', data: s.data, error })),
          complete: () => safeSet(s => ({ status: 'success', data: s.data, error: null })),
        }),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
      safeSet(s => ({ ...s, status: 'pending', error: null }));
      // Drives the work and state tracking even when the caller doesn't subscribe.
      shared$.subscribe({ error: () => {} });
      return shared$;
    },
    [getMethod, safeSet],
  );

  const reset = useCallback(() => safeSet(idle), [safeSet]);

  useDebugValue(`Action: ${state.status}`);

  return {
    run,
    pending: state.status === 'pending',
    status: state.status,
    data: state.data,
    error: state.error,
    reset,
  };
}
