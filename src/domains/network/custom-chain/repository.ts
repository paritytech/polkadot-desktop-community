import * as v from 'valibot';

import { createState, persistLocalStorage } from '@/shared/rxstate';
import { type GenesisHash } from '../chain/types';

import { customChainsRecordSchema } from './schemas';
import { type CustomChainEntry, type CustomChainsRecord } from './types';

const customChains$ = createState<CustomChainsRecord>({});

persistLocalStorage(customChains$, {
  key: 'pb:custom-chains',
  decode: raw => v.parse(customChainsRecordSchema, JSON.parse(raw)),
});

export const customChainRepository = {
  entries$: customChains$,
  add(genesisHash: GenesisHash, entry: CustomChainEntry) {
    return customChains$.set(prev => ({ ...prev, [genesisHash]: entry }));
  },
  remove(genesisHash: GenesisHash) {
    return customChains$.set(prev => {
      const next = { ...prev };
      delete next[genesisHash];
      return next;
    });
  },
};
