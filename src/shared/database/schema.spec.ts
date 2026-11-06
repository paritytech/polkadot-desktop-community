import 'fake-indexeddb/auto';

import Dexie from 'dexie';
import { afterEach, describe, expect, it } from 'vitest';

import { appDatabase, database } from './index';
import { migrateProductStorageToV12 } from './migrations';
import { migrateProductPermissionsToV2 } from './schema';
import { type ProductPermissionsRow } from './types';

const TABLE_NAMES = [
  'products',
  'dashboardLayouts',
  'productStorage',
  'productExecutableCache',
  'declinedUpdates',
  'coreStorage',
  'deviceIdentity',
  'themeSettings',
  'lightClientDatabases',
] as const;

const MIGRATION_DB_NAME = 'schema-spec-migration-test';

describe('unified database', () => {
  afterEach(async () => {
    await appDatabase.transaction('rw', appDatabase.tables, async () => {
      for (const table of appDatabase.tables) await table.clear();
    });
    await Dexie.delete(MIGRATION_DB_NAME);
  });

  it('opens at version 13 with all 9 tables', async () => {
    await appDatabase.open();
    expect(appDatabase.verno).toBe(13);
    expect(appDatabase.tables.map(t => t.name).sort()).toEqual([...TABLE_NAMES].sort());
  });

  it('round-trips a row through a registry table', async () => {
    const value = new Uint8Array([1, 2, 3]);
    await database.productStorage.put({ key: 'k', value });
    const row = await database.productStorage.get('k');
    expect(row?.value).toEqual(value);
  });

  it('exposes the productExecutableCache table', async () => {
    await appDatabase.open();
    expect(database.productExecutableCache).toBeDefined();
    const row = {
      key: 'app.dot#app',
      baseName: 'app.dot',
      kind: 'app',
      domain: 'app.app.dot',
      contenthash: '0x00' as const,
      status: 'ready',
      sizeBytes: 1,
      updatedAt: 1,
    };
    await database.productExecutableCache.put(row);
    expect(await database.productExecutableCache.get('app.dot#app')).toEqual(row);
  });

  // The v1 schema, mirrored from schema.ts as it was before the v2 bump. Only used
  // to seed legacy rows; the v2 upgrade itself runs the REAL production function.
  const SCHEMA_V1 = {
    products: 'baseName, pinned, createdAt',
    dashboardLayouts: 'id, updatedAt',
    aliasPermissions: 'key',
    productLocalStorage: 'productId',
    productPermissions: 'productId',
    productExecutableCache: 'key, baseName',
  };

  // Legacy (pre-v2) row shape: permission entries carry no `modality`. Kept loose
  // so the seed data needs no type assertions — the production migration is what
  // adds the field.
  type LegacySeedRow = {
    productId: string;
    devicePermissions: { payload: { name: string }; modality?: string; status: string }[];
    remotePermissions: { payload: { type: string; pattern?: string }; modality?: string; status: string }[];
  };

  // Seed a v1 database, then reopen it at v2 wired to the production migration
  // (`migrateProductPermissionsToV2`) — so the assertions cover the real upgrade
  // code, not a copy of it. Returns every migrated row by productId.
  const runV2Migration = async (rows: LegacySeedRow[]): Promise<Map<string, ProductPermissionsRow | undefined>> => {
    const v1 = new Dexie(MIGRATION_DB_NAME);
    v1.version(1).stores(SCHEMA_V1);
    await v1.open();
    await v1.table('productPermissions').bulkAdd(rows);
    v1.close();

    const v2 = new Dexie(MIGRATION_DB_NAME);
    v2.version(1).stores(SCHEMA_V1);
    v2.version(2).upgrade(migrateProductPermissionsToV2);
    await v2.open();

    const table = v2.table<ProductPermissionsRow>('productPermissions');
    const migrated = new Map<string, ProductPermissionsRow | undefined>();
    for (const row of rows) migrated.set(row.productId, await table.get(row.productId));
    v2.close();
    return migrated;
  };

  it('stamps modality:app on legacy device and remote entries across every row', async () => {
    const migrated = await runV2Migration([
      {
        productId: 'a',
        devicePermissions: [{ payload: { name: 'Camera' }, status: 'granted' }],
        remotePermissions: [{ payload: { type: 'ChainSubmit' }, status: 'denied' }],
      },
      {
        productId: 'b',
        devicePermissions: [{ payload: { name: 'Microphone' }, status: 'denied' }],
        remotePermissions: [],
      },
    ]);

    // Every row is migrated — not just the first (guards against a filtered/partial upgrade).
    expect(migrated.get('a')?.devicePermissions).toEqual([{ modality: 'app', payload: { name: 'Camera' }, status: 'granted' }]);
    expect(migrated.get('a')?.remotePermissions).toEqual([
      { modality: 'app', payload: { type: 'ChainSubmit' }, status: 'denied' },
    ]);
    expect(migrated.get('b')?.devicePermissions).toEqual([
      { modality: 'app', payload: { name: 'Microphone' }, status: 'denied' },
    ]);
    expect(migrated.get('b')?.remotePermissions).toEqual([]);
  });

  it('tolerates a legacy row missing a permission array (does not abort the upgrade)', async () => {
    // A partially-written / older row may lack devicePermissions or remotePermissions.
    // The upgrade must default and survive — an unguarded `.map` would throw and
    // abort the v2 transaction, leaving the DB permanently unopenable.
    const migrated = await runV2Migration([
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions, @typescript-eslint/no-explicit-any
      { productId: 'partial', remotePermissions: [{ payload: { type: 'WebRtc' }, status: 'granted' }] } as any,
    ]);

    expect(migrated.get('partial')?.devicePermissions).toEqual([]);
    expect(migrated.get('partial')?.remotePermissions).toEqual([
      { modality: 'app', payload: { type: 'WebRtc' }, status: 'granted' },
    ]);
  });

  it('preserves an already-stamped modality (idempotent re-run does not clobber)', async () => {
    const migrated = await runV2Migration([
      {
        productId: 'x',
        devicePermissions: [{ payload: { name: 'Camera' }, modality: 'widget', status: 'granted' }],
        remotePermissions: [],
      },
    ]);

    expect(migrated.get('x')?.devicePermissions).toEqual([
      { payload: { name: 'Camera' }, modality: 'widget', status: 'granted' },
    ]);
  });

  // The store map `schema.ts` yields at v11, mirrored to seed a pre-v12 database.
  const SCHEMA_V11 = {
    products: 'baseName, pinned, createdAt',
    dashboardLayouts: 'id, updatedAt',
    productLocalStorage: 'productId',
    productExecutableCache: 'key, baseName',
    declinedUpdates: 'key, baseName',
    coreStorage: 'key, slotTag, productId, [slotTag+productId]',
    deviceIdentity: 'id',
    themeSettings: 'id',
    lightClientDatabases: 'genesisHash',
  };

  it('v12 moves every truapi entry to its own row and drops the old store', async () => {
    const v11 = new Dexie(MIGRATION_DB_NAME);
    v11.version(11).stores(SCHEMA_V11);
    await v11.open();
    await v11.table('productLocalStorage').bulkAdd([
      { productId: 'truapi', data: { ka: new Uint8Array([1, 2]), kb: new Uint8Array() } },
      { productId: 'legacy.dot', data: { old: new Uint8Array([9]) } },
    ]);
    v11.close();

    const v12 = new Dexie(MIGRATION_DB_NAME);
    v12.version(11).stores(SCHEMA_V11);
    v12.version(12).stores({ productStorage: 'key', productLocalStorage: null }).upgrade(migrateProductStorageToV12);
    await v12.open();

    const rows = await v12.table<{ key: string; value: Uint8Array }>('productStorage').toArray();
    expect(rows.map(row => [row.key, [...row.value]]).sort()).toEqual([
      ['ka', [1, 2]],
      ['kb', []],
    ]);
    expect(v12.tables.map(t => t.name)).not.toContain('productLocalStorage');
    v12.close();
  });
});
