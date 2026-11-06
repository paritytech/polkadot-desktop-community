import { asProductId } from '@parity/truapi';
import { type Observable, Subject } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const productEntries = new Map<string, Uint8Array>();
const coreSlots = new Map<string, Uint8Array>();

const toKey = (bytes: Uint8Array) => bytes.join(',');

const ONE = asProductId('one.dot');

// `writeSlot` is a spy rather than a bare arrow so the descriptor it now receives can
// be asserted. It keeps the map write, so the round-trip tests below are unaffected.
const mocks = vi.hoisted(() => ({ writeSlot: vi.fn() }));

import { coreStorageUseCase, productStorageUseCase } from '@/domains/product';

import { createCoreStorageCallbacks, createProductStorageCallbacks } from './storageCallbacks';

// Both storage use cases end in Dexie; spied in place over two maps so the callbacks'
// encoding is what these cases observe.
vi.spyOn(productStorageUseCase, 'readEntry').mockImplementation(key => Promise.resolve(productEntries.get(key)));
vi.spyOn(productStorageUseCase, 'writeEntry').mockImplementation((key, value) => {
  productEntries.set(key, value);

  return Promise.resolve();
});
vi.spyOn(productStorageUseCase, 'clearEntry').mockImplementation(key => {
  productEntries.delete(key);

  return Promise.resolve();
});
const entryStreams = new Map<string, Subject<Uint8Array | undefined>>();

const streamFor = (key: string) => {
  const existing = entryStreams.get(key);
  if (existing) return existing;

  const created = new Subject<Uint8Array | undefined>();
  entryStreams.set(key, created);

  return created;
};

vi.spyOn(productStorageUseCase, 'watchEntry').mockImplementation((key): Observable<Uint8Array | undefined> => streamFor(key));
vi.spyOn(coreStorageUseCase, 'readSlot').mockImplementation(encodedKey => Promise.resolve(coreSlots.get(toKey(encodedKey))));
vi.spyOn(coreStorageUseCase, 'writeSlot').mockImplementation((...args) => {
  mocks.writeSlot(...args);
  coreSlots.set(toKey(args[0]), args[1]);

  return Promise.resolve();
});
vi.spyOn(coreStorageUseCase, 'clearSlot').mockImplementation(encodedKey => {
  coreSlots.delete(toKey(encodedKey));

  return Promise.resolve();
});

describe('createProductStorageCallbacks', () => {
  beforeEach(() => {
    productEntries.clear();
    entryStreams.clear();
  });

  it('resolves undefined for a key that was never written', async () => {
    const result = { current: createProductStorageCallbacks() };

    await expect(result.current.productStorage.read('absent')).resolves.toBeUndefined();
  });

  it('round-trips a written value', async () => {
    const result = { current: createProductStorageCallbacks() };

    await result.current.productStorage.write('k', new Uint8Array([7]));

    await expect(result.current.productStorage.read('k')).resolves.toEqual(new Uint8Array([7]));
  });

  it('clears a value', async () => {
    const result = { current: createProductStorageCallbacks() };

    await result.current.productStorage.write('k', new Uint8Array([7]));
    await result.current.productStorage.clear('k');

    await expect(result.current.productStorage.read('k')).resolves.toBeUndefined();
  });

  // The core takes hex on the wire, not bytes, and `None` means the key was cleared.
  it('emits each change as hex, and a cleared key as undefined', async () => {
    const { productStorage } = createProductStorageCallbacks();
    const items: (string | undefined)[] = [];

    const pump = (async () => {
      for await (const item of productStorage.subscribeStorage('k')) {
        items.push(item.isOk() ? item.value.value : undefined);
        if (items.length === 2) return;
      }
    })();

    streamFor('k').next(new Uint8Array([1, 2]));
    streamFor('k').next(undefined);
    await pump;

    expect(items).toEqual(['0x0102', undefined]);
  });

  // Upstream: "A write that leaves the stored bytes unchanged emits nothing."
  it('drops a write that did not change the bytes', async () => {
    const { productStorage } = createProductStorageCallbacks();
    const items: (string | undefined)[] = [];

    const pump = (async () => {
      for await (const item of productStorage.subscribeStorage('k')) {
        items.push(item.isOk() ? item.value.value : undefined);
        if (items.length === 2) return;
      }
    })();

    streamFor('k').next(new Uint8Array([1]));
    streamFor('k').next(new Uint8Array([1]));
    streamFor('k').next(new Uint8Array([2]));
    await pump;

    expect(items).toEqual(['0x01', '0x02']);
  });
});

describe('createCoreStorageCallbacks', () => {
  beforeEach(() => coreSlots.clear());

  it('resolves undefined for an unwritten slot', async () => {
    const result = { current: createCoreStorageCallbacks() };

    await expect(result.current.coreStorage.readCoreStorage({ tag: 'AuthSession' })).resolves.toBeUndefined();
  });

  it('round-trips a slot', async () => {
    const result = { current: createCoreStorageCallbacks() };

    await result.current.coreStorage.writeCoreStorage({ tag: 'AuthSession' }, new Uint8Array([1, 2]));

    await expect(result.current.coreStorage.readCoreStorage({ tag: 'AuthSession' })).resolves.toEqual(new Uint8Array([1, 2]));
  });

  it('clears a slot', async () => {
    const result = { current: createCoreStorageCallbacks() };

    await result.current.coreStorage.writeCoreStorage({ tag: 'AuthSession' }, new Uint8Array([1]));
    await result.current.coreStorage.clearCoreStorage({ tag: 'AuthSession' });

    await expect(result.current.coreStorage.readCoreStorage({ tag: 'AuthSession' })).resolves.toBeUndefined();
  });

  // Distinct typed slots must not collide once encoded — a shared key would let one
  // product's stored permission answer another's prompt.
  it('keeps two permission slots distinct', async () => {
    const result = { current: createCoreStorageCallbacks() };
    const request = { tag: 'IdentityDisclosure' } as const;
    const first = { tag: 'PermissionAuthorization', value: { scope: 'a.dot', request } } as const;
    const second = { tag: 'PermissionAuthorization', value: { scope: 'b.dot', request } } as const;

    await result.current.coreStorage.writeCoreStorage(first, new Uint8Array([1]));
    await result.current.coreStorage.writeCoreStorage(second, new Uint8Array([2]));

    await expect(result.current.coreStorage.readCoreStorage(first)).resolves.toEqual(new Uint8Array([1]));
    await expect(result.current.coreStorage.readCoreStorage(second)).resolves.toEqual(new Uint8Array([2]));
  });
});

describe('createCoreStorageCallbacks — key descriptor', () => {
  beforeEach(() => {
    coreSlots.clear();
    mocks.writeSlot.mockClear();
  });

  it('forwards the permission slot key fields alongside the encoded key', async () => {
    const { coreStorage } = createCoreStorageCallbacks();

    await coreStorage.writeCoreStorage(
      { tag: 'PermissionAuthorization', value: { scope: 'one.dot', request: { tag: 'Device', value: 'Camera' } } },
      new Uint8Array([1]),
    );

    expect(mocks.writeSlot).toHaveBeenCalledWith(expect.any(Uint8Array), new Uint8Array([1]), {
      slotTag: 'PermissionAuthorization',
      productId: 'one.dot',
      request: expect.any(Uint8Array),
    });
  });

  // The bug these pin: both variants carry a `productId` the core's own types declare,
  // and neither was indexed — so their slots were invisible to the removal sweep and
  // outlived the product for the life of the install. An auto-signing capability is the
  // sharp end of that.
  it('indexes an auto-signing key by its product', async () => {
    const { coreStorage } = createCoreStorageCallbacks();

    await coreStorage.writeCoreStorage({ tag: 'AutoSigningKey', value: { productId: ONE } }, new Uint8Array([3]));

    expect(mocks.writeSlot).toHaveBeenCalledWith(expect.any(Uint8Array), new Uint8Array([3]), {
      slotTag: 'AutoSigningKey',
      productId: 'one.dot',
    });
  });

  it('indexes a product subtree by its product, ignoring the session it is scoped to', async () => {
    const { coreStorage } = createCoreStorageCallbacks();

    await coreStorage.writeCoreStorage(
      { tag: 'ProductSubtree', value: { sessionId: 'session-1', productId: ONE } },
      new Uint8Array([4]),
    );

    expect(mocks.writeSlot).toHaveBeenCalledWith(expect.any(Uint8Array), new Uint8Array([4]), {
      slotTag: 'ProductSubtree',
      productId: 'one.dot',
    });
  });

  it('indexes a product manifest by its label', async () => {
    const { coreStorage } = createCoreStorageCallbacks();

    await coreStorage.writeCoreStorage({ tag: 'ProductManifest', value: { productLabel: 'one' } }, new Uint8Array([5]));

    expect(mocks.writeSlot).toHaveBeenCalledWith(expect.any(Uint8Array), new Uint8Array([5]), {
      slotTag: 'ProductManifest',
      productLabel: 'one',
    });
  });

  // A slot keyed by something other than a product must not acquire a `productId`, or
  // the sweep would delete core state that belongs to no product.
  it('does not index a slot whose key carries no product', async () => {
    const { coreStorage } = createCoreStorageCallbacks();

    await coreStorage.writeCoreStorage({ tag: 'AllowanceKeys', value: { sessionId: 'session-1' } }, new Uint8Array([6]));

    expect(mocks.writeSlot).toHaveBeenCalledWith(expect.any(Uint8Array), new Uint8Array([6]), {
      slotTag: 'AllowanceKeys',
    });
  });

  it('forwards only the tag for a slot that is not product scoped', async () => {
    const { coreStorage } = createCoreStorageCallbacks();

    await coreStorage.writeCoreStorage({ tag: 'AuthSession' }, new Uint8Array([2]));

    expect(mocks.writeSlot).toHaveBeenCalledWith(expect.any(Uint8Array), new Uint8Array([2]), {
      slotTag: 'AuthSession',
    });
  });
});
