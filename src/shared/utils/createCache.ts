import { nullable } from './functions';

type CachedRecord<T> = {
  expires: number;
  value: T;
};

export type CacheLookup<T> = { hit: true; value: T } | { hit: false };

export const createCache = <K extends PropertyKey, T>({ now: getTs }: { now(): number }) => {
  const records: Map<K, CachedRecord<T>> = new Map();
  const requests: Map<K, Promise<CachedRecord<T>>> = new Map();

  const cache = {
    // Returns a hit/miss discriminator so callers can distinguish "no entry"
    // from "entry whose value is nullish" (T may legally include null).
    async get(key: K): Promise<CacheLookup<T>> {
      let record = records.get(key);
      if (nullable(record)) {
        try {
          record = await requests.get(key);
        } catch {
          // do nothing
        }
      }

      if (!record) return { hit: false };

      const now = getTs();
      if (now > record.expires) {
        cache.delete(key);
        return { hit: false };
      }

      return { hit: true, value: record.value };
    },

    set(key: K, value: T, ttl: number) {
      const now = getTs();
      const record: CachedRecord<T> = {
        expires: now + ttl,
        value,
      };
      records.set(key, record);
      return record;
    },

    setRequest(key: K, request: Promise<T>, ttl: number) {
      const chainedRequest = request
        .then(value => cache.set(key, value, ttl))
        .finally(() => {
          requests.delete(key);
        });

      requests.set(key, chainedRequest);
      // Observe the rejection so a request that fails before any consumer
      // awaits `cache.get(key)` does not surface as an unhandled rejection.
      chainedRequest.catch(() => null);

      return chainedRequest;
    },

    async setAny(key: K, value: T | Promise<T>, ttl: number) {
      if (value instanceof Promise) {
        return cache.setRequest(key, value, ttl);
      } else {
        return cache.set(key, value, ttl);
      }
    },

    delete(key: K) {
      records.delete(key);
      requests.delete(key);
    },

    clear() {
      records.clear();
      requests.clear();
    },
  };

  return cache;
};
