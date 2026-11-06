import 'fake-indexeddb/auto';

import { asProductId } from '@parity/truapi';
import { type CoreStorageKey, encodeCoreStorageKey } from '@parity/truapi-host';
import { toHex } from 'polkadot-api/utils';
import { beforeEach, describe, expect, it } from 'vitest';

import { database } from '@/shared/database';

import { coreStorageUseCase } from './coreStorage';

const VALUE = new Uint8Array([1]);
const TLD = '.dot';

const PERMISSION: CoreStorageKey = {
  tag: 'PermissionAuthorization',
  value: { scope: 'caller.dot', request: { tag: 'IdentityDisclosure' } },
};
const LABEL_PERMISSION: CoreStorageKey = {
  tag: 'PermissionAuthorization',
  value: { scope: 'caller', request: { tag: 'AccountAccess', value: { target: 'target' } } },
};
const MANIFEST: CoreStorageKey = { tag: 'ProductManifest', value: { productLabel: 'caller' } };
const SUBTREE: CoreStorageKey = {
  tag: 'ProductSubtree',
  value: { sessionId: 'session-1', productId: asProductId('caller.dot') },
};
const OTHER_PRODUCT: CoreStorageKey = {
  tag: 'PermissionAuthorization',
  value: { scope: 'other', request: { tag: 'AccountAccess', value: { target: 'caller' } } },
};

/** A row as the core's own write path stores it: key, value, and nothing else. */
async function putBareRow(key: CoreStorageKey): Promise<string> {
  const hex = toHex(encodeCoreStorageKey(key));
  await database.coreStorage.put({ key: hex, value: VALUE });

  return hex;
}

async function keysLeft(): Promise<string[]> {
  return (await database.coreStorage.toArray()).map(row => row.key).sort();
}

beforeEach(async () => {
  await database.coreStorage.clear();
});

describe('coreStorageUseCase.backfillDescriptors', () => {
  it('records the owner of rows written without one', async () => {
    const permission = await putBareRow(PERMISSION);
    const labelPermission = await putBareRow(LABEL_PERMISSION);
    const manifest = await putBareRow(MANIFEST);

    await coreStorageUseCase.backfillDescriptors();

    expect(await database.coreStorage.get(permission)).toMatchObject({
      slotTag: 'PermissionAuthorization',
      productId: 'caller.dot',
    });
    expect(await database.coreStorage.get(labelPermission)).toMatchObject({
      slotTag: 'PermissionAuthorization',
      productLabel: 'caller',
    });
    expect(await database.coreStorage.get(manifest)).toMatchObject({ slotTag: 'ProductManifest', productLabel: 'caller' });
  });

  it('leaves a row whose key does not decode untouched', async () => {
    await database.coreStorage.put({ key: '0xff', value: VALUE });

    await coreStorageUseCase.backfillDescriptors();

    expect(await database.coreStorage.get('0xff')).toEqual({ key: '0xff', value: VALUE });
  });
});

describe('coreStorageUseCase.clearProductSlots', () => {
  it('drops the slots a product owns by id and by label, and nothing else', async () => {
    for (const key of [PERMISSION, LABEL_PERMISSION, MANIFEST, SUBTREE]) await putBareRow(key);
    const kept = await putBareRow(OTHER_PRODUCT);
    await coreStorageUseCase.backfillDescriptors();

    await coreStorageUseCase.clearProductSlots({ productId: 'caller.dot', tld: TLD });

    expect(await keysLeft()).toEqual([kept]);
  });
});
