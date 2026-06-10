import { describe, expect, it } from 'vitest';

import { createSlot } from '@/shared/di';

import { createFeature } from './createFeature';

describe('feature.inject collision', () => {
  it('keeps ALL handlers when one feature injects multiple times into one slot', () => {
    const slot = createSlot({ name: 'collisionTestSlot' });
    const feature = createFeature({ name: 'test/collision' });

    feature.inject(slot, () => null);
    feature.inject(slot, () => null);
    feature.inject(slot, () => null);

    expect(slot.$handlers.getState()).toHaveLength(3);
  });
});
