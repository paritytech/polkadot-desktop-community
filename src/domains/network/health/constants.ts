// A live chain is overdue strictly past this many block times without a block.
export const OVERDUE_BLOCK_TIMES = 3;

// A chain is stalled once no block landed for at least this long and `MIN_STALL_BLOCKS` block times.
export const MIN_STALL_MS = 30_000;

export const MIN_STALL_BLOCKS = 10;
