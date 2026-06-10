import { keyBy } from 'lodash-es';
import { useMemo } from 'react';

import { useRead } from '@/shared/hooks';

import { chainResource } from './resource';
import { type Chain, type GenesisHash } from './types';

export const useChains = () => {
  return useRead(chainResource, {
    params: {},
    defaultValue: [],
    map: cache => cache,
  });
};

export const useChainsMap = () => {
  const { data: chains, pending } = useChains();

  const map = useMemo<Record<GenesisHash, Chain>>(() => keyBy(chains, 'genesisHash'), [chains]);

  return { data: map, pending };
};
