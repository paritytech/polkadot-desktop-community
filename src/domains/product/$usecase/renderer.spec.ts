import { toHex } from 'polkadot-api/utils';
import * as v from 'valibot';
import { describe, expect, it, vi } from 'vitest';

import { type HexString, hexString } from '@/shared/types';
import { ipfsRawResource } from '@/domains/network';
import { executableArchiveResource } from '../product/manifest/resource';
import { type ExecutableContent } from '../product/manifest/types';
import { type Product } from '../product/types';

import { rendererUseCase } from './renderer';
import { resolveProductUseCase } from './resolve';

const GATEWAY = 'https://ipfs.example';
const WORKER_HASH: HexString = '0xdeadbeef';
const ARCHIVE_HASH: HexString = '0xc1d1';

// Smallest byte sequences the host's sniffer accepts; the bytes past the magic are
// never read.
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const GIF = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
const PNG_HEX = v.parse(hexString, toHex(PNG));
const GIF_HEX = v.parse(hexString, toHex(GIF));

function productWithWorker(): Product {
  return {
    baseName: 'a.dot',
    displayName: 'A',
    description: '',
    icon: { cid: '', format: 'png' },
    executables: {
      worker: {
        kind: 'worker',
        identifier: 'worker.a.dot',
        appVersion: [0, 0, 1],
        entrypoint: 'index.js',
        includes: { chat: true, pocket: false },
        contenthash: WORKER_HASH,
      },
    },
  };
}

function archiveWith(files: Record<string, Uint8Array>): ExecutableContent {
  return {
    contenthash: ARCHIVE_HASH,
    archive: { domain: 'worker.a.dot', origin: 'polkadot://worker.a.dot', files },
  };
}

describe('rendererUseCase.resolveImage', () => {
  it('reads a Bulletin blob through the CID it already carries', async () => {
    const seen: string[] = [];
    ipfsRawResource.instead(({ cid }) => {
      seen.push(cid);

      return PNG;
    });

    const url = await rendererUseCase.resolveImage({
      productId: 'a.dot',
      source: { tag: 'Bulletin', value: 'bafyimage' },
      ipfsGatewayUrl: GATEWAY,
    });

    // The wire value goes in verbatim — it is a CID, not a hash to be converted.
    expect(seen).toEqual(['bafyimage']);
    expect(url).toMatch(/^data:image\/png;base64,/);
  });

  it('reads an archive path out of the product worker archive', async () => {
    vi.spyOn(resolveProductUseCase, 'resolveProduct').mockResolvedValue(productWithWorker());
    executableArchiveResource.instead(() => archiveWith({ 'img/logo.png': PNG }));

    const url = await rendererUseCase.resolveImage({
      productId: 'a.dot',
      source: { tag: 'Archive', value: '/img/logo.png' },
      ipfsGatewayUrl: GATEWAY,
    });

    // Leading slash tolerated, as it is for the worker's own module ids.
    expect(url).toMatch(/^data:image\/png;base64,/);
  });

  it('draws nothing for a format outside the host allowlist', async () => {
    ipfsRawResource.instead(() => GIF);

    const url = await rendererUseCase.resolveImage({
      productId: 'a.dot',
      source: { tag: 'Bulletin', value: 'bafygif' },
      ipfsGatewayUrl: GATEWAY,
    });

    expect(url).toBeNull();
  });

  it('draws nothing when the archive does not carry the path', async () => {
    vi.spyOn(resolveProductUseCase, 'resolveProduct').mockResolvedValue(productWithWorker());
    executableArchiveResource.instead(() => archiveWith({ 'img/other.png': PNG }));

    const url = await rendererUseCase.resolveImage({
      productId: 'a.dot',
      source: { tag: 'Archive', value: 'img/logo.png' },
      ipfsGatewayUrl: GATEWAY,
    });

    expect(url).toBeNull();
  });

  it('draws nothing when the product has no worker to draw from', async () => {
    vi.spyOn(resolveProductUseCase, 'resolveProduct').mockResolvedValue(null);

    const url = await rendererUseCase.resolveImage({
      productId: 'gone.dot',
      source: { tag: 'Archive', value: 'img/logo.png' },
      ipfsGatewayUrl: GATEWAY,
    });

    expect(url).toBeNull();
  });

  it('draws an inline source from its own bytes, reading neither IPFS nor the archive', async () => {
    const bulletin = vi.fn(() => PNG);
    ipfsRawResource.instead(bulletin);
    const resolveProduct = vi.spyOn(resolveProductUseCase, 'resolveProduct');

    const inline = await rendererUseCase.resolveImage({
      productId: 'a.dot',
      source: { tag: 'Inline', value: PNG_HEX },
      ipfsGatewayUrl: GATEWAY,
    });
    ipfsRawResource.instead(() => PNG);
    const bulletinUrl = await rendererUseCase.resolveImage({
      productId: 'a.dot',
      source: { tag: 'Bulletin', value: 'bafyimage' },
      ipfsGatewayUrl: GATEWAY,
    });

    expect(inline).toMatch(/^data:image\/png;base64,/);
    expect(inline).toBe(bulletinUrl);
    expect(bulletin).not.toHaveBeenCalled();
    expect(resolveProduct).not.toHaveBeenCalled();
  });

  it('draws nothing for inline bytes outside the host allowlist', async () => {
    const url = await rendererUseCase.resolveImage({
      productId: 'a.dot',
      source: { tag: 'Inline', value: GIF_HEX },
      ipfsGatewayUrl: GATEWAY,
    });

    expect(url).toBeNull();
  });
});
