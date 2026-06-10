import { useMemo } from 'react';

import { useRead } from '@/shared/hooks';
import { type HexString } from '@/shared/types';
import { ipfsService, useIpfsRawData } from '@/domains/network';
import { type Product } from '../types';

import { type ExecutableKind } from './constants';
import { archiveCacheKey, executableArchiveResource, liveContenthashResource, missingArchiveCacheKey } from './resource';
import { manifestService } from './service';
import { type Icon } from './types';

// Fetches the IPFS archive for a product's executable of the given kind and
// registers it with the Electron sandbox so `polkadot://<identifier>` URLs
// resolve to that archive's files. The resource reads the executable's
// `identifier` off the product — no subname derivation at the call site.
export const useExecutableArchive = (params: Nullable<{ product: Product; kind: ExecutableKind }>) => {
  return useRead(executableArchiveResource, {
    params: params ?? null,
    defaultValue: null,
    map(cache, { product, kind }) {
      const executable = product.executables[kind];
      if (!executable) return cache[missingArchiveCacheKey(product.baseName, kind)];
      return cache[archiveCacheKey(product.baseName, kind, executable.contenthash)];
    },
  });
};

// Resolves a manifest `Icon` (CID + format) to a base64 data URL via the IPFS
// raw resource. Returns `null` while bytes are loading or when the icon has
// no CID (e.g. native products).
export const useProductIcon = (icon: Nullable<Icon>) => {
  const cid = icon?.cid && icon.cid.length > 0 ? icon.cid : null;
  const { data: bytes, pending, error } = useIpfsRawData(cid);

  const dataUrl = useMemo(() => {
    // Unknown format → render a placeholder (null): the product stays
    // launchable, the host never sniffs or auto-corrects the bytes.
    if (!bytes || !icon || !manifestService.isRenderableIconFormat(icon.format)) return null;
    const format = icon.format.toLowerCase();
    if (format !== 'png' && format !== 'jpeg') return null;
    return ipfsService.toDataUrl(bytes, format);
  }, [bytes, icon]);

  return { data: dataUrl, pending, error };
};

export const useLiveExecutableContenthash = (params: Nullable<{ product: Product; kind: ExecutableKind }>) => {
  return useRead(liveContenthashResource, {
    params,
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- narrowing null to typed defaultValue
    defaultValue: null as HexString | null,
    map(cache, { product, kind }) {
      const executable = product.executables[kind];
      if (!executable) return null;
      return cache[`${product.baseName}#${kind}`] ?? null;
    },
  });
};
