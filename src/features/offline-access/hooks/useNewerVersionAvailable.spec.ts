// @vitest-environment happy-dom

import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useNewerVersionAvailable } from './useNewerVersionAvailable';

const { usePersistedProductByIdMock, useLiveExecutableContenthashMock } = vi.hoisted(() => ({
  usePersistedProductByIdMock: vi.fn(),
  useLiveExecutableContenthashMock: vi.fn(),
}));

vi.mock('@/domains/product', () => ({
  usePersistedProductById: () => usePersistedProductByIdMock(),
  useLiveExecutableContenthash: () => useLiveExecutableContenthashMock(),
}));

const hexAa = '0xaa' satisfies `0x${string}`;
const hexBb = '0xbb' satisfies `0x${string}`;

describe('useNewerVersionAvailable', () => {
  it('returns null when product is not pinned', () => {
    usePersistedProductByIdMock.mockReturnValue({
      data: { pinned: false, executables: { worker: { contenthash: hexAa } } },
    });
    useLiveExecutableContenthashMock.mockReturnValue({ data: hexBb });
    const { result } = renderHook(() => useNewerVersionAvailable('a.dot'));
    expect(result.current).toBeNull();
  });

  it('returns null when live equals pinned', () => {
    usePersistedProductByIdMock.mockReturnValue({
      data: { pinned: true, executables: { worker: { contenthash: hexAa } } },
    });
    useLiveExecutableContenthashMock.mockReturnValue({ data: hexAa });
    const { result } = renderHook(() => useNewerVersionAvailable('a.dot'));
    expect(result.current).toBeNull();
  });

  it('returns the live contenthash when pinned and live differs', () => {
    usePersistedProductByIdMock.mockReturnValue({
      data: { pinned: true, executables: { worker: { contenthash: hexAa } } },
    });
    useLiveExecutableContenthashMock.mockReturnValue({ data: hexBb });
    const { result } = renderHook(() => useNewerVersionAvailable('a.dot'));
    expect(result.current).toEqual({ contenthash: hexBb });
  });
});
