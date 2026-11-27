import { type Observable, EMPTY, combineLatest, concat, defer, map, of, switchMap, timer } from 'rxjs';

import { type ChainPoolWatcher } from '@/shared/chain-connection';
import { online$ } from '@/shared/env';
import { appVisible$ } from '@/shared/utils';
import { type Environment } from '@/domains/application';
import {
  type Chain,
  type KnownChain,
  type NetworkHealth,
  type NetworkMonitorModel,
  type NetworkStatus,
  chainRegistry,
  getChains,
  networkHealthService,
  networkMonitorService,
  watchLightClientLifecycles,
} from '@/domains/network';

import { networkMonitor } from './state/networkMonitor';

type NetworkMonitorDeps = {
  watchPool: (watcher: ChainPoolWatcher<Chain>) => VoidFunction;
  watchLifecycles: typeof watchLightClientLifecycles;
  isReachable: (chain: Chain) => boolean;
  getChains: () => Promise<Chain[]>;
  online$: Observable<boolean>;
  visible$: Observable<boolean>;
};

type MonitoredEnvironment = Pick<Environment, 'peopleChain' | 'bulletinChain' | 'dotnsChain'>;

const defaultDeps: NetworkMonitorDeps = {
  watchPool: watcher => chainRegistry.watch(watcher),
  watchLifecycles: listener => watchLightClientLifecycles(listener),
  isReachable: chain => chainRegistry.isReachable(chain),
  getChains: () => getChains(),
  online$,
  visible$: appVisible$,
};

/**
 * Seeds the monitor with the environment's chains, then follows the chain pool and the light client into
 * `networkMonitor.model` and judges `networkMonitor.health` until the returned stop. Rejects, watching nothing, when
 * the chain catalog cannot be read. The stop leaves both states as they are.
 */
async function start(environment: MonitoredEnvironment, deps: NetworkMonitorDeps = defaultDeps): Promise<VoidFunction> {
  const catalog = await deps.getChains();
  networkMonitor.model.set(networkMonitorService.createModel(listKnownChains(environment, catalog)));

  const stopPool = deps.watchPool({
    onActivity(activity) {
      networkMonitor.model.set(model => networkMonitorService.recordChainActivity(model, activity));
    },
    onBestBlock(genesisHash, blockNumber) {
      const now = Date.now();
      networkMonitor.model.set(model => networkMonitorService.recordBestBlock(model, genesisHash, blockNumber, now));
    },
  });
  const stopLifecycles = deps.watchLifecycles((genesisHash, lifecycle) => {
    networkMonitor.model.set(model => networkMonitorService.recordLightClientLifecycle(model, genesisHash, lifecycle));
  });
  const health = watchHealth(deps).subscribe(value => {
    networkMonitor.health.set(value);
  });

  return () => {
    stopPool();
    stopLifecycles();
    health.unsubscribe();
  };
}

/** The monitored chains, read at each change of the model, with the live verdict over them. */
function networkStatus$({ isReachable }: Pick<NetworkMonitorDeps, 'isReachable'> = defaultDeps): Observable<NetworkStatus> {
  return networkMonitor.model.value$.pipe(
    map(model => {
      const now = Date.now();
      const chains = networkMonitorService.readNetworkStatus(model, isReachable, now);
      return { chains, readAt: now, verdict: networkHealthService.describeLiveNetwork(chains) };
    }),
  );
}

// The relay is the catalog chain the people chain is a parachain of.
function listKnownChains(environment: MonitoredEnvironment, catalog: readonly Chain[]): KnownChain[] {
  const relayGenesis = environment.peopleChain.parentId?.toLowerCase();
  const relay = relayGenesis === undefined ? undefined : catalog.find(chain => chain.genesisHash.toLowerCase() === relayGenesis);
  const others: KnownChain[] = [
    { role: 'assetHub', chain: environment.dotnsChain },
    { role: 'bulletin', chain: environment.bulletinChain },
    { role: 'people', chain: environment.peopleChain },
  ];
  return relay === undefined ? others : [{ role: 'relay', chain: relay }, ...others];
}

// A hidden window is judged when it shows.
function watchHealth(deps: NetworkMonitorDeps): Observable<NetworkHealth> {
  return combineLatest([networkMonitor.model.value$, deps.online$, deps.visible$]).pipe(
    switchMap(([model, online, visible]) => (visible ? judge(model, online, deps.isReachable) : EMPTY)),
  );
}

// Judges again when the first live chain would turn overdue, because a stalled chain sends no event.
function judge(model: NetworkMonitorModel, online: boolean, isReachable: (chain: Chain) => boolean): Observable<NetworkHealth> {
  return defer(() => {
    const now = Date.now();
    const clocks = networkMonitorService.readChainClocks(model, isReachable, now);
    const health = of(networkHealthService.judgeNetworkHealth(clocks, online));
    const deadline = networkHealthService.getNextOverdueAt(clocks, now);
    if (deadline === null) {
      return health;
    }
    // One past the deadline: overdue is strictly past three block times.
    return concat(health, timer(deadline + 1 - now).pipe(switchMap(() => judge(model, online, isReachable))));
  });
}

export const networkMonitorUseCase = {
  start,
  networkStatus$,
};
