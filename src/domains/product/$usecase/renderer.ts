import { type ImageSource } from '@parity/truapi';
import { fromHex } from 'polkadot-api/utils';
import { firstValueFrom } from 'rxjs';

import { ipfsRawResource, ipfsService } from '@/domains/network';
import { executableArchiveResource } from '../product/manifest/resource';
import { manifestService } from '../product/manifest/service';

import { resolveProductUseCase } from './resolve';

type ResolveImageParams = {
  productId: string;
  source: ImageSource;
  ipfsGatewayUrl: string;
};

/**
 * The bytes behind a render tree's `Image`, as a data URL the host can draw.
 *
 * A use case rather than a resource: it composes two sources, and one of them is
 * another domain's public surface — which the data layer may not read.
 *
 * `null` covers every unresolvable case. An image that cannot be fetched, is not a
 * format the host renders, or names a path the archive does not carry draws nothing;
 * the host never sniffs harder or substitutes a placeholder for a product's content.
 */
async function resolveImage({ productId, source, ipfsGatewayUrl }: ResolveImageParams): Promise<string | null> {
  const bytes = await readSource(productId, source, ipfsGatewayUrl);

  if (!bytes) return null;

  // The wire declares no format, so the bytes have to say what they are.
  const format = manifestService.sniffImageFormat(bytes);

  return format ? ipfsService.toDataUrl(bytes, format) : null;
}

async function readSource(productId: string, source: ImageSource, ipfsGatewayUrl: string): Promise<Uint8Array | null> {
  switch (source.tag) {
    case 'Inline':
      return fromHex(source.value);
    case 'Bulletin':
      return readBulletinBlob(source.value, ipfsGatewayUrl);
    case 'Archive':
      return readArchiveFile(productId, source.value, ipfsGatewayUrl);
  }
}

/**
 * Bulletin-chain content is addressed by the BLAKE2b-256 hash of its bytes, and that
 * same hash wrapped as a raw-codec CIDv1 is its IPFS address — so a Bulletin blob is
 * read through the IPFS gateway, exactly as the core's preimage lookup reads one.
 *
 * The wire value is already a CID, so it goes straight in; `ipfsService.toIpfsCid`
 * converts a *hash* and would corrupt this one.
 */
function readBulletinBlob(cid: string, gatewayUrl: string): Promise<Uint8Array | null> {
  return firstValueFrom(ipfsRawResource.read$({ cid, gatewayUrl }));
}

/**
 * `kind: 'worker'` is not a guess: a render is served by the product's worker, and
 * it is also the only kind whose archive reliably carries bytes in the renderer —
 * `executableArchiveResource` returns an empty file map for `app`/`widget` when the
 * archive store already holds them, because the main process serves those over
 * `polkadot://` instead.
 */
async function readArchiveFile(productId: string, path: string, ipfsGatewayUrl: string): Promise<Uint8Array | null> {
  const product = await resolveProductUseCase.resolveProduct(productId);
  if (!product?.executables.worker) return null;

  const content = await firstValueFrom(executableArchiveResource.read$({ product, kind: 'worker', ipfsGatewayUrl }));

  return content ? (manifestService.lookupArchiveFile(content.archive.files, path) ?? null) : null;
}

export const rendererUseCase = {
  resolveImage,
};
