import { describe, expect, it, vi } from 'vitest';

import { archiveStoreGateway } from '../product/archive-store/gateway';
import { archiveGateway } from '../product/manifest/gateway';
import { type Product } from '../product/types';

import { loadArchiveUseCase } from './loadArchive';

const product: Product = {
  baseName: 'app.dot',
  displayName: 'App',
  description: '',
  icon: { cid: '', format: 'png' },
  executables: {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- test fixture executable
    app: { kind: 'app', identifier: 'app.app.dot', appVersion: [0, 0, 0], contenthash: '0xaa' } as never,
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- test fixture executable
    widget: { kind: 'widget', identifier: 'widget.app.dot', appVersion: [0, 0, 0], contenthash: '0xcc' } as never,
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- test fixture executable
    worker: { kind: 'worker', identifier: 'worker.app.dot', appVersion: [0, 0, 0], contenthash: '0xbb' } as never,
  },
};

describe('loadArchiveUseCase.loadExecutableArchive', () => {
  it('warms main for an app on a cache miss', async () => {
    vi.spyOn(archiveStoreGateway, 'has').mockResolvedValue(false);
    const warm = vi.spyOn(archiveStoreGateway, 'warm').mockResolvedValue({ success: true });
    vi.spyOn(archiveGateway, 'fetchExecutable').mockResolvedValue({
      contenthash: '0xaa',
      archive: { domain: 'app.app.dot', origin: 'polkadot://app.app.dot', files: { 'index.html': new Uint8Array([1]) } },
    });

    await loadArchiveUseCase.loadExecutableArchive(product, 'app');

    expect(warm).toHaveBeenCalledTimes(1);
    vi.restoreAllMocks();
  });

  it('warms main for a widget on a cache miss', async () => {
    vi.spyOn(archiveStoreGateway, 'has').mockResolvedValue(false);
    const warm = vi.spyOn(archiveStoreGateway, 'warm').mockResolvedValue({ success: true });
    vi.spyOn(archiveGateway, 'fetchExecutable').mockResolvedValue({
      contenthash: '0xcc',
      archive: { domain: 'widget.app.dot', origin: 'polkadot://widget.app.dot', files: { 'index.html': new Uint8Array([1]) } },
    });

    await loadArchiveUseCase.loadExecutableArchive(product, 'widget');

    expect(warm).toHaveBeenCalledTimes(1);
    vi.restoreAllMocks();
  });

  it('does NOT warm main for a worker on a cache miss (worker runs in the renderer)', async () => {
    vi.spyOn(archiveStoreGateway, 'has').mockResolvedValue(false);
    const warm = vi.spyOn(archiveStoreGateway, 'warm').mockResolvedValue({ success: true });
    vi.spyOn(archiveGateway, 'fetchExecutable').mockResolvedValue({
      contenthash: '0xbb',
      archive: { domain: 'worker.app.dot', origin: 'polkadot://worker.app.dot', files: { 'index.js': new Uint8Array([1]) } },
    });

    const result = await loadArchiveUseCase.loadExecutableArchive(product, 'worker');

    expect(warm).not.toHaveBeenCalled();
    expect(result?.archive.files['index.js']).toEqual(new Uint8Array([1]));
    vi.restoreAllMocks();
  });
});
