import { type DefaultCache, type KeyFn, type MapCacheFn, type NormalizedKeyFn, type ResourceKey } from './types';

export function wrapKeyFactory<Params>(key: KeyFn<Params>): (params: Params) => ResourceKey {
  return params => {
    const result = key(params);

    if (Array.isArray(result)) {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      return result.flat().toSorted().join(' ') as ResourceKey;
    }

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return result as ResourceKey;
  };
}

export function createDefaultInitial<Response>() {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return {} as DefaultCache<Response>;
}

export function createDefaultCacheMapper<Params, Response>(key: NormalizedKeyFn<Params>) {
  const map: MapCacheFn<Params, Response, DefaultCache<Response>> = (cache, result, params) => {
    return {
      ...cache,
      [key(params)]: result,
    };
  };

  return map;
}
