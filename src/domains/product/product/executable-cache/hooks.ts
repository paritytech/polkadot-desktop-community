import { useMemo } from 'react';

import { useRead } from '@/shared/hooks';

import { executableCacheResource } from './resource';
import { type ExecutableCacheEntry, type ExecutableCacheStatus } from './types';

// All cache-index rows for a product (one per cached executable kind).
const useExecutableCacheEntries = (baseName: Nullable<string>): ExecutableCacheEntry[] => {
  const { data: all } = useRead(executableCacheResource, { params: {}, defaultValue: [] });
  return useMemo(() => (baseName ? all.filter(e => e.baseName === baseName) : []), [all, baseName]);
};

// Product-level offline status, aggregated across executable kinds:
// failed if any kind failed, else preparing if any is preparing, else ready if
// at least one is ready, else null (nothing cached / not pinned). A pure
// derivation over the cache index — not a use-case binding — so it lives here
// next to the read it derives from, not in `$usecase/`.
export const useOfflineCacheStatus = (baseName: Nullable<string>): ExecutableCacheStatus | null => {
  const entries = useExecutableCacheEntries(baseName);
  return useMemo(() => {
    if (entries.length === 0) return null;
    if (entries.some(e => e.status === 'failed')) return 'failed';
    if (entries.some(e => e.status === 'preparing')) return 'preparing';
    return 'ready';
  }, [entries]);
};
