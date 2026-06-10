import { StorageErr } from '@novasamatech/host-api';
import { type Container } from '@novasamatech/host-container';
import { fromPromise } from 'neverthrow';
import { useEffect } from 'react';

import { useLooseRef } from '@/shared/hooks';
import { createDefaultRateLimiter } from '@/shared/rateLimiter';
import { useTranslation } from '@/shared/translation';
import { productLocalStorageRepository, useDisplayedProduct } from '@/domains/product';

import { createOnRateLimited } from './_helpers';

export function useLocalStorage(container: Container, identifier: string) {
  const { t } = useTranslation();
  const tRef = useLooseRef(t);
  const { data: product } = useDisplayedProduct(identifier);
  const productRef = useLooseRef(product);

  useEffect(() => {
    const getProductName = () => productRef()?.baseName ?? identifier;
    const rateLimiterLocalStorageRead = createDefaultRateLimiter({
      onRateLimited: createOnRateLimited(identifier, getProductName, 'localStorageRead', tRef()),
      mapErr: reason => new StorageErr.Unknown({ reason }),
    });
    const rateLimiterLocalStorageWrite = createDefaultRateLimiter({
      onRateLimited: createOnRateLimited(identifier, getProductName, 'localStorageWrite', tRef()),
      mapErr: reason => new StorageErr.Unknown({ reason }),
    });

    const cleanupRead = container.handleLocalStorageRead((key, { ok, err }) =>
      rateLimiterLocalStorageRead.schedule(() =>
        fromPromise(productLocalStorageRepository.readEntry(identifier, key), e => e)
          .andThen(value => ok(value))
          .orElse(() => err(new StorageErr.Unknown({ reason: 'Failed to read from storage' }))),
      ),
    );

    const cleanupWrite = container.handleLocalStorageWrite(([key, value], { ok, err }) =>
      rateLimiterLocalStorageWrite.schedule(() =>
        fromPromise(productLocalStorageRepository.writeEntry(identifier, key, value), e => e)
          .andThen(() => ok(undefined))
          .orElse(() => err(new StorageErr.Unknown({ reason: 'Failed to write to storage' }))),
      ),
    );

    const cleanupClear = container.handleLocalStorageClear((key, { ok, err }) =>
      rateLimiterLocalStorageWrite.schedule(() =>
        fromPromise(productLocalStorageRepository.clearEntry(identifier, key), e => e)
          .andThen(() => ok(undefined))
          .orElse(() => err(new StorageErr.Unknown({ reason: 'Failed to clear storage' }))),
      ),
    );

    return () => {
      cleanupRead();
      cleanupWrite();
      cleanupClear();
      rateLimiterLocalStorageRead.destroy();
      rateLimiterLocalStorageWrite.destroy();
    };
  }, [container, identifier]);
}
