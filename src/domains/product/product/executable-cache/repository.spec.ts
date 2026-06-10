import 'fake-indexeddb/auto';

import { afterEach, describe, expect, it } from 'vitest';

import { database } from '@/shared/database';

import { executableCacheRepository } from './repository';

afterEach(async () => {
  await database.productExecutableCache.clear();
});

describe('executableCacheRepository', () => {
  it('upserts a status row and reads it by product', async () => {
    await executableCacheRepository.setStatus('app.dot', 'app', 'app.app.dot', '0xaa', 'preparing');
    const rows = await executableCacheRepository.getByBaseName('app.dot');
    expect(rows).toEqual([
      expect.objectContaining({ baseName: 'app.dot', kind: 'app', status: 'preparing', contenthash: '0xaa' }),
    ]);
  });

  it('overwrites the same (product,kind) row on re-set', async () => {
    await executableCacheRepository.setStatus('app.dot', 'app', 'app.app.dot', '0xaa', 'preparing');
    await executableCacheRepository.setStatus('app.dot', 'app', 'app.app.dot', '0xbb', 'ready', 10);
    const rows = await executableCacheRepository.getByBaseName('app.dot');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual(expect.objectContaining({ status: 'ready', contenthash: '0xbb', sizeBytes: 10 }));
  });

  it('deletes all rows for a product', async () => {
    await executableCacheRepository.setStatus('app.dot', 'app', 'app.app.dot', '0xaa', 'ready');
    await executableCacheRepository.setStatus('app.dot', 'worker', 'worker.app.dot', '0xbb', 'ready');
    await executableCacheRepository.deleteByBaseName('app.dot');
    expect(await executableCacheRepository.getByBaseName('app.dot')).toEqual([]);
  });
});
