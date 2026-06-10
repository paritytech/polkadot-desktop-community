import { type Observable, combineLatest, map } from 'rxjs';

import { online$ } from '@/shared/env';
import { type Chain, type ConnectionStatus, chainConnectionStatusResource } from '@/domains/network';

import { type PeopleChainStatus } from './types';

export function toPeopleChainStatus(online: boolean, status: ConnectionStatus): PeopleChainStatus {
  if (!online) return 'offline';

  switch (status) {
    case 'connected':
      return 'connected';
    default:
      return 'reconnecting';
  }
}

/**
 * People-chain status as seen by the UI: combines browser connectivity
 * (`online$`, environment) with the raw chain connection status (the network
 * domain resource, which holds the connection alive and dedups per chain).
 */
export function peopleChainStatus$(chain: Chain): Observable<PeopleChainStatus> {
  return combineLatest([online$, chainConnectionStatusResource.read$(chain)]).pipe(
    map(([online, status]) => toPeopleChainStatus(online, status)),
  );
}
