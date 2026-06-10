import { createNanoEvents } from 'nanoevents';
import { type Observable, BehaviorSubject, finalize, shareReplay, tap } from 'rxjs';

import { createDefaultCacheMapper, createDefaultInitial, wrapKeyFactory } from './generic';
import { type KeyFn, type Resource, type ResourceKey } from './types';

type MapCacheFn<Params, Response, Cache> = (cache: Cache, result: Response, params: Params) => Cache;

type DefaultCache<Response> = Record<ResourceKey, Response>;

type StreamFactoryFn<P, V> = (params: P) => Observable<V>;

type StreamParams<Params, Response, Cache> = {
  fn: StreamFactoryFn<Params, Response>;
  key: KeyFn<Params>;
  cache: {
    initial: Cache;
    map: MapCacheFn<Params, Response, Cache>;
  };
};

type CacheOrDefault<Cache, Response> = [Cache] extends [never] ? DefaultCache<Response> : Cache;

function build<Params, Response, Cache>({
  key,
  fn,
  cache,
}: StreamParams<Params, Response, Cache>): Resource<Params, Response, Cache> {
  const events = createNanoEvents<{ read: Parameters<Resource<Params, Response, Cache>['onRead']>[0] }>();

  const createKey = wrapKeyFactory(key);

  const cache$ = new BehaviorSubject<Cache>(cache.initial);
  const subscriptions: Record<ResourceKey, Observable<Response>> = {};

  function pending$(params: Params) {
    const key = createKey(params);
    return subscriptions[key] ?? null;
  }

  function read$(params: Params) {
    const key = createKey(params);
    const existing = subscriptions[key];
    if (existing) {
      return existing;
    }

    const stream$ = fn(params).pipe(
      tap(response => cache$.next(cache.map(cache$.value, response, params))),
      finalize(() => delete subscriptions[key]),
      shareReplay({ bufferSize: 1, refCount: true }),
    );

    subscriptions[key] = stream$;

    events.emit('read', stream$, params);

    return stream$;
  }

  function invalidate(params: Partial<Params>): Cache {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const key = createKey(params as Params);
    delete subscriptions[key];
    const previous = cache$.value;
    if (typeof previous === 'object' && previous !== null && key in previous) {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const copy = { ...previous } as Record<string, unknown>;
      delete copy[key];
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      cache$.next(copy as Cache);
    }
    return previous;
  }

  function invalidateAll() {
    for (const key of Object.keys(subscriptions)) {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      delete subscriptions[key as ResourceKey];
    }
    cache$.next(cache.initial);
  }

  return {
    key: createKey,
    cache$,
    read$,
    pending$,
    onRead(callback) {
      return events.on('read', callback);
    },
    invalidate,
    invalidateAll,
    snapshot() {
      return cache$.value;
    },
  };
}

export const createStreamResource = <Params = unknown>({ key }: { key: KeyFn<Params> }) => {
  const internal = <Response = never, Cache = never>(params: Partial<StreamParams<Params, Response, Cache>> = {}) => {
    return {
      subscribe<Response>(fn: StreamFactoryFn<Params, Response>) {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        return internal<Response, Cache>({ ...params, fn } as Partial<StreamParams<Params, Response, Cache>>);
      },
      cache<Cache>(cache: NonNullable<StreamParams<Params, Response, Cache>['cache']>) {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        return internal<Response, Cache>({ ...params, cache } as Partial<StreamParams<Params, Response, Cache>>);
      },
      build(): Resource<Params, Response, CacheOrDefault<Cache, Response>> {
        if (!params.fn) {
          throw new Error('Missing subscription function');
        }

        if (params.cache) {
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          return build<Params, Response, Cache>({
            cache: params.cache,
            key,
            fn: params.fn,
          }) as Resource<Params, Response, CacheOrDefault<Cache, Response>>;
        } else {
          const initial = createDefaultInitial<Response>();
          const cacheMapper = createDefaultCacheMapper<Params, Response>(wrapKeyFactory(key));

          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          return build<Params, Response, DefaultCache<Response>>({
            cache: {
              initial,
              map: cacheMapper,
            },
            key,
            fn: params.fn,
          }) as Resource<Params, Response, CacheOrDefault<Cache, Response>>;
        }
      },
    };
  };

  return internal();
};
