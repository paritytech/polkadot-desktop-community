import { type NetworkHealth } from '@/domains/network';

import { type StatusTone } from './types';

// Slots in a chain's history strip, filled from the right as blocks arrive.
export const HISTORY_SLOTS = 48;

// A live share from which a producing chain reads healthy.
export const HEALTHY_SHARE = 5 / 6;

export const TICK_MS = 250;

export const RING_RADIUS = 12.5;

export const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

export const HEALTH_TONES: Record<NetworkHealth, StatusTone> = {
  connected: 'ok',
  syncing: 'idle',
  unstable: 'warn',
  offline: 'err',
  unused: 'idle',
  unreachable: 'err',
};
