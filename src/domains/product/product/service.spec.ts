import { describe, expect, it } from 'vitest';

import { productService } from './service';
import { type Product } from './types';

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    baseName: 'hackm3.dot',
    displayName: 'Hack Me',
    description: '',
    icon: { cid: 'abc', format: 'png' },
    executables: {},
    ...overrides,
  };
}

describe('matchesQuery', () => {
  it('matches the display name case-insensitively', () => {
    expect(productService.matchesQuery(makeProduct({ displayName: 'Acme Wallet' }), 'acme')).toBe(true);
  });

  it('matches the base name', () => {
    expect(productService.matchesQuery(makeProduct({ baseName: 'hackm3.dot' }), 'HACKM3')).toBe(true);
  });

  it('rejects a query matching neither field', () => {
    expect(productService.matchesQuery(makeProduct(), 'unrelated')).toBe(false);
  });
});
