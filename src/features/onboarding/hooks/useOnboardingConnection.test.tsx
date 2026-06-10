// @vitest-environment happy-dom

import { act, renderHook } from '@testing-library/react';
import { type BehaviorSubject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const usePeopleChainStatus = vi.fn();
const useAuthentication = vi.fn();

vi.mock('@/aggregates/network-settings', () => ({
  usePeopleChainStatus: () => usePeopleChainStatus(),
}));
vi.mock('@novasamatech/host-papp-react-ui', () => ({
  useAuthentication: () => useAuthentication(),
}));
// `online$` is mocked as a BehaviorSubject so the test can drive offline/online
// transitions that feed the "internet restored" window.
vi.mock('@/shared/env', async () => {
  const { BehaviorSubject } = await import('rxjs');
  return { online$: new BehaviorSubject(true) };
});

import { online$ } from '@/shared/env';

import { useOnboardingConnection } from './useOnboardingConnection';

const onlineSubject = online$ as unknown as BehaviorSubject<boolean>;

beforeEach(() => {
  vi.useFakeTimers();
  onlineSubject.next(true);
  useAuthentication.mockReturnValue({ pairingStatus: { step: 'pairing' }, authenticate: vi.fn() });
  usePeopleChainStatus.mockReturnValue({ networkName: 'X', status: 'offline' });
});

afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe('useOnboardingConnection', () => {
  it('returns offline when the people chain is offline', () => {
    const { result } = renderHook(() => useOnboardingConnection());
    expect(result.current).toBe('offline');
  });

  it('returns reaching when reconnecting without a recent internet restore', () => {
    usePeopleChainStatus.mockReturnValue({ networkName: 'X', status: 'reconnecting' });
    const { result } = renderHook(() => useOnboardingConnection());
    expect(result.current).toBe('reaching');
  });

  it('shows restored briefly after the browser comes back online, then reaching', () => {
    usePeopleChainStatus.mockReturnValue({ networkName: 'X', status: 'reconnecting' });
    const { result, rerender } = renderHook(() => useOnboardingConnection());
    expect(result.current).toBe('reaching');

    act(() => {
      onlineSubject.next(false);
      onlineSubject.next(true);
    });
    rerender();
    expect(result.current).toBe('restored');

    act(() => {
      vi.advanceTimersByTime(1600);
    });
    rerender();
    expect(result.current).toBe('reaching');
  });

  it('returns accountSetup when connected with a recognized identity error', () => {
    usePeopleChainStatus.mockReturnValue({ networkName: 'X', status: 'connected' });
    useAuthentication.mockReturnValue({
      pairingStatus: { step: 'pairingError', message: 'OriginPersonProviderError' },
      authenticate: vi.fn(),
    });
    const { result } = renderHook(() => useOnboardingConnection());
    expect(result.current).toBe('accountSetup');
  });
});
