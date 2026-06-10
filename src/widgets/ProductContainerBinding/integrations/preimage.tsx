import { PreimageSubmitErr } from '@novasamatech/host-api';
import { type Container } from '@novasamatech/host-container';
import { useSession } from '@novasamatech/host-papp-react-ui';
import { type PolkadotSigner } from '@polkadot-api/signer';
import { errAsync, fromPromise } from 'neverthrow';
import { useEffect, useRef } from 'react';

import { useConfirmation } from '@/shared/components';
import { useLooseRef } from '@/shared/hooks';
import { createDefaultRateLimiter } from '@/shared/rateLimiter';
import { useTranslation } from '@/shared/translation';
import { hasProperty } from '@/shared/utils';
import { environmentUseCase, usePappProvider } from '@/domains/application';
import { chainRegistry, ipfsGateway, ipfsService } from '@/domains/network';
import { useDisplayedProduct } from '@/domains/product';
import { PreimageSubmitModal } from '../ui/PreimageSubmitModal';

import { createOnRateLimited } from './_helpers';

const LOOKUP_POLL_INTERVAL_MS = 10_000;
// Below the poll interval so each lookup resolves (or aborts) before the next tick.
const LOOKUP_FETCH_TIMEOUT_MS = 8_000;
const TX_TIMEOUT_MS = 120_000;

async function submitPreimage(value: Uint8Array, signer: PolkadotSigner, cache: Map<string, Uint8Array>) {
  const key = ipfsService.computePreimageKey(value);

  const { api, unlock } = await chainRegistry.lockApi((await environmentUseCase.getActive()).bulletinChain);
  try {
    if (!hasProperty(api.api.tx, 'TransactionStorage')) {
      throw new Error('TransactionStorage pallet is not supported');
    }
    const tx = api.api.tx.TransactionStorage.store({ data: value });

    await new Promise<void>((resolve, reject) => {
      let resolved = false;
      const subscription = tx.signSubmitAndWatch(signer).subscribe({
        next: ev => {
          if (!resolved && ev.type === 'txBestBlocksState' && ev.found) {
            resolved = true;
            clearTimeout(timeoutId);
            subscription.unsubscribe();
            resolve();
          }
        },
        error: (e: unknown) => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeoutId);
            subscription.unsubscribe();
            reject(e);
          }
        },
      });

      const timeoutId = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          subscription.unsubscribe();
          reject(new Error('Transaction timed out'));
        }
      }, TX_TIMEOUT_MS);
    });
  } finally {
    unlock();
  }

  cache.set(key, value);

  return key;
}

export function usePreimage(container: Container, identifier: string) {
  const cache = useRef(new Map<string, Uint8Array>());
  const confirm = useConfirmation();
  const papp = usePappProvider();
  const pappRef = useLooseRef(papp);
  const { session } = useSession();
  const sessionRef = useLooseRef(session);
  const { t } = useTranslation();
  const tRef = useLooseRef(t);
  const { data: product } = useDisplayedProduct(identifier);
  const productRef = useLooseRef(product);

  useEffect(() => {
    if (!container) return;

    const getProductName = () => productRef()?.baseName ?? identifier;
    const rateLimiterPreimage = createDefaultRateLimiter({
      onRateLimited: createOnRateLimited(identifier, getProductName, 'preimage', tRef()),
      mapErr: (reason: string) => new PreimageSubmitErr.Unknown({ reason }),
    });

    const lookupCleanups = new Set<VoidFunction>();

    // --- handlePreimageSubmit ---
    const unsubSubmit = container.handlePreimageSubmit((value, { err }) =>
      rateLimiterPreimage.schedule(() => {
        const confirmed = confirm('preimageSubmit', ({ resolve, reject }) => (
          <PreimageSubmitModal
            product={productRef()}
            request={{ dataSize: value.byteLength }}
            onAllow={resolve}
            onDeny={reject}
          />
        ));

        return fromPromise(confirmed, e => (e instanceof Error ? e.message : 'Unknown error'))
          .andThen(() => {
            const papp = pappRef();
            const sessionId = sessionRef()?.id;
            if (!papp) return errAsync('Papp provider not ready');
            if (!sessionId) return errAsync('No active session');
            return papp.allowance.getBulletinSigner(sessionId, identifier).mapErr(e => e.message);
          })
          .andThen(signer =>
            fromPromise(submitPreimage(value, signer, cache.current), e =>
              e instanceof Error ? e.message : 'Preimage submit failed',
            ),
          )
          .orElse(reason => {
            console.error(`[${identifier}] Preimage submit error:`, reason);

            return err(new PreimageSubmitErr.Unknown({ reason }));
          });
      }),
    );

    // --- handlePreimageLookupSubscribe ---
    const unsubLookup = container.handlePreimageLookupSubscribe((key, send, interrupt) => {
      let consecutiveFailures = 0;
      let stopped = false;

      // Check local cache first
      const cached = cache.current.get(key);
      if (cached) {
        send(cached);
      } else {
        send(null);
      }

      // Poll IPFS gateway
      const poll = async () => {
        if (stopped) return;

        // Check cache again (may have been populated by a submit)
        const cachedValue = cache.current.get(key);
        if (cachedValue) {
          send(cachedValue);
          consecutiveFailures = 0;

          return;
        }

        try {
          const data = await ipfsGateway.fetchRaw(ipfsService.toIpfsCid(key), { timeoutMs: LOOKUP_FETCH_TIMEOUT_MS });
          if (data) {
            cache.current.set(key, data);
            send(data);
            consecutiveFailures = 0;
          } else {
            consecutiveFailures++;
          }
        } catch (e) {
          console.error(`[${identifier}] Preimage lookup error:`, e);
          consecutiveFailures++;
        }

        if (consecutiveFailures >= 3) {
          console.error(`[${identifier}] Preimage lookup: 3 consecutive failures, interrupting`);
          interrupt(undefined);
        }
      };

      const intervalId = setInterval(poll, LOOKUP_POLL_INTERVAL_MS);
      const initialTimeoutId = setTimeout(poll, 1000);

      const cleanup = () => {
        stopped = true;
        clearInterval(intervalId);
        clearTimeout(initialTimeoutId);
        lookupCleanups.delete(cleanup);
      };

      lookupCleanups.add(cleanup);

      return cleanup;
    });

    return () => {
      unsubSubmit();
      unsubLookup();
      rateLimiterPreimage.destroy();
      for (const cleanup of lookupCleanups) {
        cleanup();
      }
      cache.current.clear();
    };
  }, [container, identifier, confirm]);
}
