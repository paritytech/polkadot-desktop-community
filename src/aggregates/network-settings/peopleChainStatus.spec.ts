import { describe, expect, it } from 'vitest';

import { toPeopleChainStatus } from './peopleChainStatus';

describe('toPeopleChainStatus', () => {
  it('maps offline browser to offline regardless of chain status', () => {
    expect(toPeopleChainStatus(false, 'connected')).toBe('offline');
    expect(toPeopleChainStatus(false, 'connecting')).toBe('offline');
  });

  it('maps a connected chain to connected when online', () => {
    expect(toPeopleChainStatus(true, 'connected')).toBe('connected');
  });

  it('maps any non-connected chain status to reconnecting when online', () => {
    expect(toPeopleChainStatus(true, 'connecting')).toBe('reconnecting');
    expect(toPeopleChainStatus(true, 'disconnected')).toBe('reconnecting');
  });
});
