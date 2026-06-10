import { describe, expect, it } from 'vitest';

import { getVariantFromGridSize } from './widgetModalConstants';

describe('getVariantFromGridSize', () => {
  it('maps known grid sizes to widget variants', () => {
    expect(getVariantFromGridSize(1, 2)).toBe('small');
    expect(getVariantFromGridSize(1, 4)).toBe('medium');
    expect(getVariantFromGridSize(1, 8)).toBe('large');
    expect(getVariantFromGridSize(2, 4)).toBe('horizontal');
  });

  it('falls back to small for unknown sizes', () => {
    expect(getVariantFromGridSize(3, 3)).toBe('small');
  });
});
