import 'fake-indexeddb/auto';

import { afterEach, describe, expect, it } from 'vitest';

import { database } from '@/shared/database';
import { productStorageKeyService } from '../local-storage/service';

import { productStorageUseCase } from './productStorage';

const { readEntry, writeEntry, clearEntry, clearOwnerEntries, watchEntry } = productStorageUseCase;

const keyOf = (productId: string, key: string) => `${productStorageKeyService.ownerPrefix(productId)}${key}`;

describe('productStorageUseCase', () => {
  afterEach(async () => {
    await database.productStorage.clear();
  });

  it('keeps both of two concurrent writes to different keys', async () => {
    await Promise.all([writeEntry('a', new Uint8Array([1])), writeEntry('b', new Uint8Array([2]))]);

    await expect(readEntry('a')).resolves.toEqual(new Uint8Array([1]));
    await expect(readEntry('b')).resolves.toEqual(new Uint8Array([2]));
  });

  it('clears one key without touching another', async () => {
    await writeEntry('a', new Uint8Array([1]));
    await writeEntry('b', new Uint8Array([2]));

    await clearEntry('a');

    await expect(readEntry('a')).resolves.toBeUndefined();
    await expect(readEntry('b')).resolves.toEqual(new Uint8Array([2]));
  });

  it('clears exactly one owner, leaving an owner whose id it prefixes', async () => {
    await writeEntry(keyOf('app.dot', 'a'), new Uint8Array([1]));
    await writeEntry(keyOf('app.dot.x', 'a'), new Uint8Array([2]));

    await clearOwnerEntries('app.dot');

    await expect(readEntry(keyOf('app.dot', 'a'))).resolves.toBeUndefined();
    await expect(readEntry(keyOf('app.dot.x', 'a'))).resolves.toEqual(new Uint8Array([2]));
  });

  // Dexie also re-emits on mutations from other databases sharing the process, so the
  // assertions follow the latest value rather than counting emissions.
  it('emits the current value and later changes for a watched key', async () => {
    const values: (Uint8Array | undefined)[] = [];
    const subscription = watchEntry('a').subscribe(value => values.push(value));

    await expect.poll(() => values.length).toBeGreaterThan(0);
    expect(values.at(-1)).toBeUndefined();

    await writeEntry('a', new Uint8Array([1]));
    await expect.poll(() => values.at(-1)).toEqual(new Uint8Array([1]));

    subscription.unsubscribe();
  });
});
