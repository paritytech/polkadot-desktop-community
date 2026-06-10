import 'fake-indexeddb/auto';

import Dexie from 'dexie';
import { afterEach, describe, expect, it } from 'vitest';

// Proves the unified migration pattern used by ../schema.ts: an upgrade callback
// registered on version N runs against pre-existing version N-1 data. Uses a
// throwaway DB so it never touches polkadot-desktop-app-v1.
const DB_NAME = 'migration-flow-example';

afterEach(async () => {
  await Dexie.delete(DB_NAME);
});

describe('migration flow', () => {
  it('runs an upgrade function when bumping the version', async () => {
    const v1 = new Dexie(DB_NAME);
    v1.version(1).stores({ things: 'id' });
    await v1.open();
    await v1.table('things').add({ id: 'a', renamed: false });
    v1.close();

    const v2 = new Dexie(DB_NAME);
    v2.version(1).stores({ things: 'id' });
    v2.version(2)
      .stores({ things: 'id' })
      .upgrade(async tx => {
        await tx
          .table('things')
          .toCollection()
          .modify(row => {
            row.renamed = true;
          });
      });
    await v2.open();
    expect(v2.verno).toBe(2);
    const row = await v2.table('things').get('a');
    expect(row.renamed).toBe(true);
    v2.close();
  });
});
