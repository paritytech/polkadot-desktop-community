import * as v from 'valibot';
import { describe, expect, expectTypeOf, it } from 'vitest';

import { productPermissionsSchema } from './schemas';
import { type ProductPermissions } from './types';

describe('productPermissionsSchema', () => {
  it('matches the domain type', () => {
    expectTypeOf<v.InferOutput<typeof productPermissionsSchema>>().toEqualTypeOf<ProductPermissions>();
  });

  it('parses a stored row', () => {
    const row = {
      productId: 'p1',
      devicePermissions: [{ payload: { name: 'Camera' }, status: 'granted' }],
      remotePermissions: [{ payload: { type: 'ChainSubmit' }, status: 'ask' }],
    };
    expect(v.parse(productPermissionsSchema, row).productId).toBe('p1');
  });
});

describe('productPermissionsSchema modality', () => {
  it('normalizes entries missing modality to app', () => {
    const parsed = v.parse(productPermissionsSchema, {
      productId: 'coin-flip.dot',
      devicePermissions: [{ payload: { name: 'Camera' }, status: 'granted' }],
      remotePermissions: [{ payload: { type: 'ChainSubmit' }, status: 'denied' }],
    });

    expect(parsed.devicePermissions[0]?.modality).toBe('app');
    expect(parsed.remotePermissions[0]?.modality).toBe('app');
  });

  it('preserves a stored widget modality', () => {
    const parsed = v.parse(productPermissionsSchema, {
      productId: 'coin-flip.dot',
      devicePermissions: [{ payload: { name: 'Camera' }, modality: 'widget', status: 'granted' }],
      remotePermissions: [
        { payload: { type: 'Remote', pattern: 'https://api.example.com' }, modality: 'widget', status: 'granted' },
      ],
    });

    expect(parsed.devicePermissions[0]?.modality).toBe('widget');
    expect(parsed.remotePermissions[0]?.modality).toBe('widget');
  });

  it('rejects an unknown modality value', () => {
    const result = v.safeParse(productPermissionsSchema, {
      productId: 'coin-flip.dot',
      devicePermissions: [{ payload: { name: 'Camera' }, modality: 'pocket', status: 'granted' }],
      remotePermissions: [],
    });

    expect(result.success).toBe(false);
  });
});
