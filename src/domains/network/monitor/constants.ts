import { type ChainRole } from './types';

// Only a memory ceiling, never how many bars are drawn.
export const MAX_BARS = 120;

// A chain outside the known roles reports no block time, so it is judged against a typical parachain's.
export const EXTRA_BLOCK_TIME_MS = 6000;

export const ROLE_BLOCK_TIME_MS: Record<ChainRole, number> = {
  relay: 6000,
  assetHub: 2000,
  bulletin: 6000,
  people: 2000,
};
