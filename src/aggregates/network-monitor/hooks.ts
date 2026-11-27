import { type Observable } from 'rxjs';

import { useRead } from '@/shared/hooks';
import { useRxState } from '@/shared/rxstate';
import { type NetworkHealth, type NetworkStatus } from '@/domains/network';

import { networkMonitorUseCase } from './networkMonitorUseCase';
import { networkMonitor } from './state/networkMonitor';

const EMPTY_STATUS: NetworkStatus = { chains: [], readAt: 0, verdict: { health: 'unused' } };

// `networkStatus$`'s first parameter is its deps, which `useRead` would fill with its params.
function watchNetworkStatus(): Observable<NetworkStatus> {
  return networkMonitorUseCase.networkStatus$();
}

/** The network's health verdict, judged by the monitor the app starts at boot. */
export function useNetworkHealth(): NetworkHealth {
  const [health] = useRxState(networkMonitor.health);
  return health;
}

/** The monitored chains and the live verdict, followed only while the calling component is mounted. */
export function useNetworkStatus(): NetworkStatus {
  const { data } = useRead(watchNetworkStatus, { params: {}, defaultValue: EMPTY_STATUS });
  return data;
}
