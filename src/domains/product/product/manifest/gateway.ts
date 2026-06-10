import { firstValueFrom } from 'rxjs';

import { type ArchiveContent, ipfsRawResource, ipfsService } from '@/domains/network';
import { dotNsService } from '../../dotns/service';
import { type Product } from '../types';

import { type ExecutableKind } from './constants';
import { type ExecutableContent } from './types';

// Two-phase fetch for backward compatibility:
//   a) CID points to a CAR upload → gateway returns the CAR directly
//   b) CID points to a directory  → gateway returns just index.html; re-fetch
//      with `?format=car` to get the directory as a CAR.
// Once all deployments use directory CIDs, phase (a) can be dropped.
async function fetchArchiveFiles(cid: string): Promise<ArchiveContent> {
  const raw = await firstValueFrom(ipfsRawResource.read$({ cid }));
  // A failed fetch must propagate, not collapse into an empty file set: the
  // request would otherwise resolve to a blank archive that the resource caches
  // forever (`staleAfter: Infinity`), never retrying the transient failure.
  // Throwing keeps it out of the cache so a later mount re-attempts.
  if (!raw) throw new Error(`IPFS fetch returned no data for cid ${cid}`);

  if (ipfsService.isCarFile(raw)) {
    return ipfsService.parseCarFile(raw);
  }

  const carBytes = await firstValueFrom(ipfsRawResource.read$({ cid, asCar: true }));
  if (!carBytes) return { 'index.html': raw };

  return ipfsService.parseIpfsResponse(carBytes);
}

// Fetch + assemble a product executable's archive from IPFS. Returns null when
// the kind is absent or the contenthash can't be decoded. Pure CID→bytes — the
// wire boundary for executable archives, with no caching or persistence of its
// own (those are the resource's and the disk store's jobs respectively).
async function fetchExecutable(product: Product, kind: ExecutableKind): Promise<ExecutableContent | null> {
  const executable = product.executables[kind];
  if (!executable) return null;
  const { identifier, contenthash } = executable;
  const cid = ipfsService.decodeContenthash(contenthash);
  if (!cid) return null;
  const files = await fetchArchiveFiles(cid);
  return { contenthash, archive: { domain: identifier, origin: dotNsService.generateProductBase(identifier), files } };
}

export const archiveGateway = { fetchExecutable };
