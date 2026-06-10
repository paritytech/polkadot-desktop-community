import { useAuthentication } from '@novasamatech/host-papp-react-ui';
import { type Observable, concat, distinctUntilChanged, map, of, pairwise, shareReplay, startWith, switchMap, timer } from 'rxjs';

import { online$ } from '@/shared/env';
import { useRead } from '@/shared/hooks';
import { usePeopleChainStatus } from '@/aggregates/network-settings';
import { deriveOnboardingConnectionState } from '../connectionState';
import { type OnboardingConnectionState } from '../types';

const RESTORED_WINDOW_MS = 1500;

/**
 * Emits `true` for a brief window right after the browser comes back online
 * (offline → online), then `false`. Pure stream derived from `online$` — no
 * React timers/refs/previous-value tracking. `false` at rest and whenever the
 * browser goes offline. `switchMap` cancels an in-flight window if connectivity
 * flips again before it elapses.
 *
 * `refCount: false` (like `online$` itself) keeps the `pairwise` history alive
 * across mounts: a remounting consumer keeps observing real offline → online
 * transitions instead of restarting from `online$`'s single replayed value and
 * missing a flap that happened while it was unsubscribed.
 */
const justRestored$: Observable<boolean> = online$.pipe(
  pairwise(),
  switchMap(([prev, current]) =>
    !prev && current ? concat(of(true), timer(RESTORED_WINDOW_MS).pipe(map(() => false))) : of(false),
  ),
  startWith(false),
  distinctUntilChanged(),
  shareReplay({ bufferSize: 1, refCount: false }),
);

const restoredSource = (): Observable<boolean> => justRestored$;

export const useOnboardingConnection = (): OnboardingConnectionState => {
  const { status } = usePeopleChainStatus();
  const { pairingStatus } = useAuthentication();
  const { data: justRestored } = useRead(restoredSource, { params: true, defaultValue: false });

  // Non-null only in the pairing error step; its presence implies the error step.
  const pairingMessage = pairingStatus.step === 'pairingError' ? pairingStatus.message : null;

  return deriveOnboardingConnectionState({ peopleStatus: status, justRestored, pairingMessage });
};
