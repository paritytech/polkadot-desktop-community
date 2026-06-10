import * as v from 'valibot';

import { hexString } from '@/shared/types';

export const blockHeight = v.pipe(v.number(), v.minValue(0), v.brand('BlockHeight'));
export const blockHash = v.pipe(hexString, v.brand('BlockHash'));

export const block = v.object({
  number: blockHeight,
  hash: blockHash,
});
