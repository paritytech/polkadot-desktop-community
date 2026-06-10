import { type SS58String } from 'polkadot-api';
import { type InferOutput } from 'valibot';

import { type HexString } from '@/shared/types';

import { type accountId } from './schemas';

export type Address =
  | {
      type: 'ss58';
      value: SS58String;
    }
  | {
      type: 'evm';
      value: HexString;
    };

export type AccountId = InferOutput<typeof accountId>;
