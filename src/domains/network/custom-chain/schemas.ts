import * as v from 'valibot';

import { genesisHash } from '../chain/schemas';

export const customChainEntrySchema = v.object({
  name: v.pipe(v.string(), v.minLength(1)),
  endpoints: v.pipe(v.array(v.pipe(v.string(), v.url())), v.minLength(1)),
});

export const customChainsRecordSchema = v.record(genesisHash, customChainEntrySchema);
