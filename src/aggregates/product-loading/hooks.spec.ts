// @vitest-environment happy-dom

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { useProductRefreshing } from './hooks';
import { onProductRefreshRequestedSideEffect } from './refresh';
import { productLoading } from './state/loading';

const requestRefresh = (identifier: string) => void onProductRefreshRequestedSideEffect.apply({ identifier });

describe('useProductRefreshing', () => {
  const productId = 'test-product';

  beforeEach(() => {
    productLoading.set(productId, false);
    productLoading.set('other-product', false);
  });

  it('is not refreshing by default', () => {
    const { result } = renderHook(() => useProductRefreshing(productId));

    expect(result.current.isRefreshing).toBe(false);
  });

  it('is refreshing when refresh was requested and product is loading', () => {
    const { result } = renderHook(() => useProductRefreshing(productId));

    act(() => {
      requestRefresh(productId);
      productLoading.set(productId, true);
    });

    expect(result.current.isRefreshing).toBe(true);
  });

  it('is not refreshing when loading without a refresh request', () => {
    const { result } = renderHook(() => useProductRefreshing(productId));

    act(() => {
      productLoading.set(productId, true);
    });

    expect(result.current.isRefreshing).toBe(false);
  });

  it('clears refreshing state when loading completes', () => {
    const { result } = renderHook(() => useProductRefreshing(productId));

    act(() => {
      requestRefresh(productId);
      productLoading.set(productId, true);
    });
    expect(result.current.isRefreshing).toBe(true);

    act(() => {
      productLoading.set(productId, false);
    });
    expect(result.current.isRefreshing).toBe(false);
  });

  it('ignores refresh requests for other products', () => {
    const { result } = renderHook(() => useProductRefreshing(productId));

    act(() => {
      requestRefresh('other-product');
      productLoading.set(productId, true);
    });

    expect(result.current.isRefreshing).toBe(false);
  });
});
