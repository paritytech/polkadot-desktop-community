import { createStreamResource } from '@/shared/resource';

import { executableCacheRepository } from './repository';
import { type ExecutableCacheEntry } from './types';

export const executableCacheResource = createStreamResource({ key: () => 'executable-cache' })
  .subscribe<ExecutableCacheEntry[]>(() => executableCacheRepository.subscribeToAll())
  .cache<ExecutableCacheEntry[]>({
    initial: [],
    map(_, entries) {
      return entries;
    },
  })
  .build();
