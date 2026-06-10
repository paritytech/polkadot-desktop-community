import { type Observable } from 'rxjs';
import { type Brand } from 'valibot';

type KeyValues = string | number | undefined | null;

export type KeyFn<Params> = (params: Params) => KeyValues | (KeyValues | KeyValues[])[];

export type NormalizedKeyFn<Params> = (params: Params) => ResourceKey;

export type MapCacheFn<Params, Response, Cache> = (cache: Cache, result: Response, params: Params) => Cache;

export type DefaultCache<Response> = Record<ResourceKey, Response>;

export type ResourceKey = string & Brand<'ResourceKey'>;

export type Resource<Params, Response, Cache> = {
  /**
   * Generate unique key for resource read operation.
   */
  key: NormalizedKeyFn<Params>;
  /**
   * Calling resource read.
   */
  read$(params: Params): Observable<Response>;
  /**
   * Return pending observable for given params.
   */
  pending$(params: Params): Observable<Response> | null;
  /**
   * In-memory cache for resource results.
   */
  cache$: Observable<Cache>;

  /**
   * Registers a callback function to be invoked when a read operation occurs.
   *
   * @param callback The function to be called when a read operation occurs. Receives an Observable of the response and the operation parameters.
   * @return A function that when called will unregister the callback and stop receiving read notifications.
   */
  onRead(callback: (observable: Observable<Response>, params: Params) => void): VoidFunction;

  /**
   * Invalidates cached data for the given params, forcing the next read to re-fetch.
   * Returns the cache snapshot before invalidation.
   */
  invalidate(params: Partial<Params>): Cache;

  /**
   * Clears all cached data, forcing subsequent reads to re-fetch from source.
   */
  invalidateAll(): void;

  /**
   * Returns the current cache value synchronously.
   * Prefer this over casting cache$ to BehaviorSubject.
   */
  snapshot(): Cache;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyResource<Params = any, Response = any, Cache = any> = Resource<Params, Response, Cache>;
