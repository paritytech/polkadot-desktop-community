import { type InferOutput } from 'valibot';

import { type block, type blockHash, type blockHeight } from './schemas';

export type BlockHeight = InferOutput<typeof blockHeight>;

export type BlockHash = InferOutput<typeof blockHash>;

export type Block = InferOutput<typeof block>;
