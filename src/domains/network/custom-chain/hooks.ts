import { useMemo } from 'react';
import * as v from 'valibot';

import { useAction, useRead } from '@/shared/hooks';
import { useChainsMap } from '../chain/hooks';
import { genesisHash } from '../chain/schemas';
import { type Chain, type GenesisHash } from '../chain/types';

import { customChainsResource, removeCustomChain } from './resource';
import { customChainService } from './service';
import { type CustomChainsRecord } from './types';

const EMPTY: CustomChainsRecord = {};

export const useCustomChains = () => {
  return useRead(customChainsResource, {
    params: {},
    defaultValue: EMPTY,
  });
};

export const useCustomChainsMap = (): Record<GenesisHash, Chain> => {
  const { data: entries } = useCustomChains();

  return useMemo(() => {
    const map: Record<GenesisHash, Chain> = {};
    for (const [hash, entry] of Object.entries(entries)) {
      const id = v.parse(genesisHash, hash);
      map[id] = customChainService.buildChain(id, entry);
    }
    return map;
  }, [entries]);
};

export const useAllChainsMap = (): { data: Record<GenesisHash, Chain>; pending: boolean } => {
  const { data: builtin, pending } = useChainsMap();
  const custom = useCustomChainsMap();

  const data = useMemo(() => ({ ...builtin, ...custom }), [builtin, custom]);

  return { data, pending };
};

export const useRemoveCustomChain = () => useAction(removeCustomChain);
