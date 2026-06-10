import { useEffect, useState } from 'react';

import { type Chain } from '../chain/types';

import { chainRegistry } from './registry';
import { type TypedClient } from './types';

export const useApi = (chain: Nullable<Chain>) => {
  const [api, setApi] = useState<TypedClient | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (chain) {
      let cancelled = false;
      const request = chainRegistry.lockApi(chain);

      request.then(
        r => {
          if (!cancelled) setApi(r.api);
        },
        err => {
          if (!cancelled) setError(err instanceof Error ? err : new Error(String(err)));
        },
      );

      return () => {
        cancelled = true;
        request.then(
          r => r.unlock(),
          () => {},
        );
      };
    }

    setApi(null);
    setError(null);
  }, [chain?.genesisHash]);

  return { api, error };
};
