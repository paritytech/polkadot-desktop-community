import { useCallback, useDebugValue, useEffect, useMemo, useRef, useState } from 'react';
import { type Observable, defer, finalize, from, isObservable, shareReplay } from 'rxjs';

import { type AnyResource } from '@/shared/resource';

import { useLooseRef } from './useLooseRef';

type FnSource<P, T> = (params: P, signal?: AbortSignal) => Promise<T> | Observable<T>;

export type ReadSource<P, T> = AnyResource<P, T, unknown> | FnSource<P, T>;

// In-flight dedup for function sources: concurrent reads sharing the same
// function reference and request key share one invocation instead of each
// firing the work independently (resources already dedup via their cache).
// The entry lives only while a request is in flight — once it settles or the
// last subscriber leaves it's evicted, so this is dedup, not a cache.
type AnyFn = FnSource<never, unknown>;
const inflightByFn = new WeakMap<AnyFn, Map<string, Observable<unknown>>>();

function sharedInflight(
  fn: AnyFn,
  requestKey: string,
  makeStream: (signal: AbortSignal) => Observable<unknown>,
): Observable<unknown> {
  let byKey = inflightByFn.get(fn);
  if (!byKey) {
    byKey = new Map();
    inflightByFn.set(fn, byKey);
  }

  const existing = byKey.get(requestKey);
  if (existing) return existing;

  // The shared request owns its abort lifecycle: the signal is aborted only
  // when the stream settles or the last subscriber leaves (refCount → 0), so a
  // single consumer unmounting can't cancel a request its peers still want.
  const controller = new AbortController();
  const shared: Observable<unknown> = defer(() => makeStream(controller.signal)).pipe(
    finalize(() => {
      controller.abort();
      // Evict only if this exact entry is still registered — a `refresh()` may
      // have already replaced it with a fresh one.
      if (byKey.get(requestKey) === shared) {
        byKey.delete(requestKey);
        if (byKey.size === 0) inflightByFn.delete(fn);
      }
    }),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  byKey.set(requestKey, shared);
  return shared;
}

function evictInflight(fn: AnyFn, requestKey: string): void {
  const byKey = inflightByFn.get(fn);
  if (!byKey) return;
  byKey.delete(requestKey);
  if (byKey.size === 0) inflightByFn.delete(fn);
}

export type ReadHookValue<D> = {
  data: D;
  pending: boolean;
  error: unknown;
  refresh: () => void;
};

type Snapshot<V> = { data: V | undefined; pending: boolean; error: unknown };

const paramsKey = (params: unknown): string => {
  try {
    return JSON.stringify(params);
  } catch {
    return String(params);
  }
};

function isResource<P>(s: ReadSource<P, unknown>): s is AnyResource<P, unknown, unknown> {
  return typeof s === 'object' && s !== null && 'read$' in s && 'cache$' in s;
}

/**
 * Reactive read hook. Binds a resource, async function, or Observable factory
 * to a component's lifecycle.
 *
 * - `params` is an object: fires on mount, re-fires when params change.
 * - `params` is `null`/`undefined`: idle.
 * - `map`: for resources, projects from `cache$` and reacts to cross-component
 *   cache updates; for function sources, transforms each emission.
 * - `defaultValue`: initial `data` until a non-undefined emission arrives.
 *   When provided, `data` is typed as `V`; otherwise `V | undefined`.
 * - `key` (function sources only): custom serializer for `params`, used as the
 *   effect/dedup key. Provide it when `params` carries values `JSON.stringify`
 *   handles poorly — large binary blobs (cost), functions (dropped silently),
 *   non-deterministic shapes. Return a short stable string. Resource sources
 *   key off the resource's own `key` and ignore this.
 * - Unmount aborts the `AbortSignal` for function sources and unsubscribes.
 */
// Resource + map + defaultValue
export function useRead<P, T, Cache, V>(
  source: AnyResource<P, T, Cache>,
  options: {
    params: Nullable<P>;
    defaultValue: V;
    map: (cache: Cache, params: P) => V | undefined;
  },
): ReadHookValue<V>;
// Resource + map (no defaultValue)
export function useRead<P, T, Cache, V>(
  source: AnyResource<P, T, Cache>,
  options: {
    params: Nullable<P>;
    map: (cache: Cache, params: P) => V | undefined;
  },
): ReadHookValue<V | undefined>;
// Resource + defaultValue (no map) — data is read$ response
export function useRead<P, T>(
  source: AnyResource<P, T, unknown>,
  options: { params: Nullable<P>; defaultValue: T },
): ReadHookValue<T>;
// Resource (no map, no defaultValue)
export function useRead<P, T>(source: AnyResource<P, T, unknown>, options: { params: Nullable<P> }): ReadHookValue<T | undefined>;
// Function + map + defaultValue
export function useRead<P, T, V>(
  source: FnSource<P, T>,
  options: {
    params: Nullable<P>;
    defaultValue: V;
    map: (value: T, params: P) => V | undefined;
    key?: (params: P) => string;
  },
): ReadHookValue<V>;
// Function + map (no defaultValue)
export function useRead<P, T, V>(
  source: FnSource<P, T>,
  options: {
    params: Nullable<P>;
    map: (value: T, params: P) => V | undefined;
    key?: (params: P) => string;
  },
): ReadHookValue<V | undefined>;
// Function + defaultValue (no map)
export function useRead<P, T>(
  source: FnSource<P, T>,
  options: { params: Nullable<P>; defaultValue: T; key?: (params: P) => string },
): ReadHookValue<T>;
// Function (no map, no defaultValue)
export function useRead<P, T>(
  source: FnSource<P, T>,
  options: { params: Nullable<P>; key?: (params: P) => string },
): ReadHookValue<T | undefined>;
export function useRead<P>(
  source: ReadSource<P, unknown>,
  options: {
    params: Nullable<P>;
    defaultValue?: unknown;
    map?: (input: unknown, params: P) => unknown;
    key?: (params: P) => string;
  },
): ReadHookValue<unknown> {
  const { params, defaultValue, map, key: keyFn } = options;
  const [snapshot, setSnapshot] = useState<Snapshot<unknown>>(() => ({
    data: defaultValue,
    // Reflect that work is imminent on the very first render when params are
    // present, so consumers don't momentarily read `pending: false` + no data
    // and mistake it for "settled with nothing".
    pending: params != null,
    error: null,
  }));
  const refreshRef = useRef<() => void>(() => {});
  const getSource = useLooseRef(source);
  const getMap = useLooseRef(map);
  const getKey = useLooseRef(keyFn);
  const key = useMemo(() => {
    if (params == null) return null;
    if (isResource(source)) return source.key(params);
    const serialize = getKey();
    return serialize ? serialize(params) : paramsKey(params);
  }, [params, source, getKey]);

  useEffect(() => {
    if (params == null) {
      setSnapshot({ data: defaultValue, pending: false, error: null });
      refreshRef.current = () => {};
      return;
    }
    const serialize = getKey();
    const requestKey = serialize ? serialize(params) : paramsKey(params);
    let triggerSub: { unsubscribe: () => void } | null = null;
    let dataSub: { unsubscribe: () => void } | null = null;

    const start = () => {
      setSnapshot(s => ({ ...s, pending: true, error: null }));
      const src = getSource();
      const mapFn = getMap();

      if (isResource(src)) {
        if (mapFn) {
          dataSub = src.cache$.subscribe({
            next: cache => {
              const value = mapFn(cache, params);
              if (value !== undefined) {
                setSnapshot(s => ({ ...s, data: value, error: null }));
              }
            },
            error: (error: unknown) => setSnapshot(s => ({ ...s, pending: false, error })),
          });
          triggerSub = src.read$(params).subscribe({
            next: () => setSnapshot(s => ({ ...s, pending: false })),
            error: (error: unknown) => setSnapshot(s => ({ ...s, pending: false, error })),
          });
        } else {
          triggerSub = src.read$(params).subscribe({
            next: (data: unknown) => setSnapshot({ data, pending: false, error: null }),
            error: (error: unknown) => setSnapshot(s => ({ ...s, pending: false, error })),
          });
        }
      } else {
        const fn = src;
        const stream$ = sharedInflight(fn, requestKey, signal => {
          const result = fn(params, signal);
          return isObservable(result) ? result : from(Promise.resolve(result));
        });
        dataSub = stream$.subscribe({
          next: value => {
            const data = mapFn ? mapFn(value, params) : value;
            // Clear `pending` on every emission; only overwrite `data` when the
            // (mapped) value is defined, so a filtering `map` keeps the default
            // without leaving the read stuck pending.
            setSnapshot(s =>
              data === undefined ? { ...s, pending: false, error: null } : { data, pending: false, error: null },
            );
          },
          error: (error: unknown) => setSnapshot(s => ({ ...s, pending: false, error })),
          // An Observable factory that completes without ever emitting must
          // still settle `pending`.
          complete: () => setSnapshot(s => ({ ...s, pending: false })),
        });
      }
    };

    start();

    refreshRef.current = () => {
      triggerSub?.unsubscribe();
      dataSub?.unsubscribe();
      triggerSub = null;
      dataSub = null;
      const src = getSource();
      if (isResource(src)) src.invalidate(params);
      else evictInflight(src, requestKey);
      start();
    };

    return () => {
      triggerSub?.unsubscribe();
      dataSub?.unsubscribe();
      refreshRef.current = () => {};
    };
  }, [key]);

  const refresh = useCallback(() => refreshRef.current(), []);

  useDebugValue(`${snapshot.pending ? 'Pending' : snapshot.error ? 'Errored' : 'Idle'} read (key: ${key})`);

  return { ...snapshot, refresh };
}
