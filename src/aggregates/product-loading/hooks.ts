import { useEffect, useState } from 'react';

import { useSideEffect } from '@/shared/di';
import { useRxState } from '@/shared/rxstate';

import { onProductRefreshRequestedSideEffect } from './refresh';
import { productLoading } from './state/loading';

// True from the moment a refresh is requested for `productId` until that
// product finishes (re)loading. Combines the refresh side effect with the
// shared loading state — drives the spinning refresh icon.
export function useProductRefreshing(productId: string) {
  const [loadingIdentifiers] = useRxState(productLoading.identifiers$);
  const isLoading = loadingIdentifiers.has(productId);
  const [refreshRequested, setRefreshRequested] = useState(false);
  const isRefreshing = refreshRequested && isLoading;

  useSideEffect(onProductRefreshRequestedSideEffect, ({ identifier }) => {
    if (identifier === productId) setRefreshRequested(true);
  });

  useEffect(() => {
    if (!isLoading) setRefreshRequested(false);
  }, [isLoading]);

  return { isRefreshing };
}
