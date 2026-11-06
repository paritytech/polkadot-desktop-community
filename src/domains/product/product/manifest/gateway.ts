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
async function fetchArchiveFiles(cid: string, gatewayUrl: string): Promise<ArchiveContent> {
  const raw = await firstValueFrom(ipfsRawResource.read$({ cid, gatewayUrl }));
  // A miss on either read must propagate, not collapse into a partial file set:
  // the archive resource would cache that forever (`staleAfter: Infinity`) and the
  // offline cache would store it as ready. Throwing keeps it out of both, so a
  // later mount re-attempts once the IPFS resource releases the miss.
  if (!raw) throw new Error(`IPFS fetch returned no data for cid ${cid}`);

  if (ipfsService.isCarFile(raw)) {
    return ipfsService.parseCarFile(raw);
  }

  const carBytes = await firstValueFrom(ipfsRawResource.read$({ cid, gatewayUrl, asCar: true }));
  if (!carBytes) throw new Error(`IPFS CAR fetch returned no data for cid ${cid}`);

  return ipfsService.parseIpfsResponse(carBytes);
}

// Fetch + assemble a product executable's archive from IPFS. Returns null when
// the kind is absent or the contenthash can't be decoded. Pure CID→bytes — the
// wire boundary for executable archives, with no caching or persistence of its
// own (those are the resource's and the disk store's jobs respectively).
// `gatewayUrl` is injected by the caller: resolving the active environment is a
// use case's job, and a gateway must not reach for one.
async function fetchExecutable(product: Product, kind: ExecutableKind, gatewayUrl: string): Promise<ExecutableContent | null> {
  const executable = product.executables[kind];
  if (!executable) return null;
  const { identifier, contenthash } = executable;
  const cid = ipfsService.decodeContenthash(contenthash);
  if (!cid) return null;
  const files = await fetchArchiveFiles(cid, gatewayUrl);
  return { contenthash, archive: { domain: identifier, origin: dotNsService.generateProductBase(identifier), files } };
}

export const archiveGateway = { fetchExecutable };
