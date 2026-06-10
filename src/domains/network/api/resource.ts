import { Observable } from 'rxjs';

import { createStreamResource } from '@/shared/resource';
import { type Chain } from '../chain/types';

import { chainRegistry } from './registry';
import { type ConnectionStatus } from './types';

/**
 * Live connection status of a single chain, keyed by genesis hash so all
 * consumers of the same chain share one status listener and one connection
 * hold (the resource cache dedups via `shareReplay`). Emits the current status
 * immediately and on every change. Holds the chain connection alive for the
 * lifetime of the subscription via `chainRegistry.api$` (which acquires the
 * refcounted lock on subscribe and releases it on unsubscribe). Its successful
 * emissions are ignored — we rely only on its side effect of keeping the socket
 * open so the status can progress to `connected` — but its errors are forwarded
 * so a network-init failure (e.g. missing runtime descriptor, provider failure)
 * propagates to the UI instead of leaving the status stuck on `reconnecting`.
 */
export const chainConnectionStatusResource = createStreamResource<Chain>({
  key: chain => chain.genesisHash,
})
  .subscribe<ConnectionStatus>(
    chain =>
      new Observable<ConnectionStatus>(subscriber => {
        subscriber.next(chainRegistry.status(chain.genesisHash));

        const unsubscribeStatus = chainRegistry.onStatusChanged(chain.genesisHash, status => {
          subscriber.next(status);
        });

        // Subscribe to hold the connection lock open (see JSDoc). Successful
        // emissions are ignored; errors are forwarded so init failures surface
        // to the UI rather than leaving the status stuck on `reconnecting`.
        const apiSubscription = chainRegistry.api$(chain).subscribe({
          error: error => subscriber.error(error),
        });

        return () => {
          unsubscribeStatus();
          apiSubscription.unsubscribe();
        };
      }),
  )
  .cache<Record<string, ConnectionStatus>>({
    initial: {},
    map: (cache, status, chain) => ({ ...cache, [chain.genesisHash]: status }),
  })
  .build();
