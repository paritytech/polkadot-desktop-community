import { asProductId } from '@parity/truapi';
import { describe, expect, it } from 'vitest';

import { coreSlotService } from './service';

const ONE = asProductId('one.dot');

describe('coreSlotService.describeSlot', () => {
  it('carries the tag of every slot', () => {
    expect(coreSlotService.describeSlot({ tag: 'AuthSession' })).toEqual({ slotTag: 'AuthSession' });
  });

  // The removal sweep queries the owner columns. A slot left unindexed here outlives
  // the product it belongs to for the life of the install.
  it.each([
    ['AutoSigningKey', { productId: ONE }],
    ['ProductSubtree', { sessionId: 'session-1', productId: ONE }],
  ])('indexes a %s slot by its product', (tag, value) => {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- the table erases the tag/value correlation the union encodes
    const descriptor = coreSlotService.describeSlot({ tag, value } as never);

    expect(descriptor.productId).toBe('one.dot');
    expect(descriptor.productLabel).toBeUndefined();
    expect(descriptor.slotTag).toBe(tag);
  });

  it.each(['one.dot', 'app.one.dot', 'localhost', 'localhost:5173'])(
    'indexes a permission scoped to the full product %s by its product',
    scope => {
      const descriptor = coreSlotService.describeSlot({
        tag: 'PermissionAuthorization',
        value: { scope, request: { tag: 'IdentityDisclosure' } },
      });

      expect(descriptor.productId).toBe(scope);
      expect(descriptor.productLabel).toBeUndefined();
    },
  );

  // The core files account access answered at the prompt under the bare label of
  // both products, so the slot belongs to every executable of the product.
  it('indexes a permission scoped to a bare label by its label', () => {
    const descriptor = coreSlotService.describeSlot({
      tag: 'PermissionAuthorization',
      value: { scope: 'one', request: { tag: 'AccountAccess', value: { target: 'two' } } },
    });

    expect(descriptor.productLabel).toBe('one');
    expect(descriptor.productId).toBeUndefined();
  });

  it('indexes a cached manifest by its label', () => {
    const descriptor = coreSlotService.describeSlot({ tag: 'ProductManifest', value: { productLabel: 'one' } });

    expect(descriptor.productLabel).toBe('one');
    expect(descriptor.productId).toBeUndefined();
  });

  // The sweep deletes by owner, so inventing one for a slot keyed by something else
  // would delete core state belonging to no product.
  it('leaves a slot keyed by something other than a product unindexed', () => {
    const descriptor = coreSlotService.describeSlot({ tag: 'AllowanceKeys', value: { sessionId: 'session-1' } });

    expect(descriptor.productId).toBeUndefined();
    expect(descriptor.productLabel).toBeUndefined();
  });

  // Encoded with the core's codec rather than restated, and only this slot carries one.
  it('encodes the request of a permission slot, and only that slot', () => {
    const permission = coreSlotService.describeSlot({
      tag: 'PermissionAuthorization',
      value: { scope: 'one.dot', request: { tag: 'Device', value: 'Camera' } },
    });
    const autoSigning = coreSlotService.describeSlot({ tag: 'AutoSigningKey', value: { productId: ONE } });

    expect(permission.request).toBeInstanceOf(Uint8Array);
    expect(autoSigning.request).toBeUndefined();
  });
});
