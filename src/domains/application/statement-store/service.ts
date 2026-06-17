import { createLazyClient, createPapiStatementStoreAdapter } from '@novasamatech/statement-store';
import { getSyncProvider } from '@polkadot-api/json-rpc-provider-proxy';
import { type JsonRpcProvider } from 'polkadot-api';
import { Subject } from 'rxjs';

import { type Chain, chainRegistry } from '@/domains/network';

import { createReconnectAwareSubscribe } from './reconnectAwareSubscribe';
import { shouldSurfaceSubmitError } from './submitErrorGate';

// The people chain comes from Remote Config (async), but the provider and
// reconnect listener are sync. Since the renderer can issue queries before
// bootstrap seeds the chain, the connect paths DEFER on `activePeopleChainReady`
// instead of throwing.
let activePeopleChain: Chain | null = null;

// Resolves when `setActivePeopleChain` runs, rejects if bootstrap fails first.
let resolveActivePeopleChain: (chain: Chain) => void = () => {};
let rejectActivePeopleChain: (error: Error) => void = () => {};
const activePeopleChainReady = new Promise<Chain>((resolve, reject) => {
  resolveActivePeopleChain = resolve;
  rejectActivePeopleChain = reject;
});
// Avoid an unhandled rejection if no query ever consumes it.
activePeopleChainReady.catch(() => null);

export function setActivePeopleChain(chain: Chain): void {
  activePeopleChain = chain;
  resolveActivePeopleChain(chain);
}

// Reject the deferred connect paths when bootstrap fails, instead of hanging forever.
export function failActivePeopleChain(error: Error): void {
  rejectActivePeopleChain(error);
}

// Sync accessor for the devtools diagnostics below; connect paths never call it.
function requireActivePeopleChain(): Chain {
  if (!activePeopleChain) {
    throw new Error('[statement-store] active people chain not resolved yet — bootstrap must run first');
  }
  return activePeopleChain;
}

// `getSyncProvider` buffers outgoing messages until we supply the inner provider
// via `onResult` — which we do once the chain is seeded, so an early query waits
// for config instead of crashing.
const peopleChainProvider: JsonRpcProvider = getSyncProvider(onResult => {
  let cancelled = false;
  activePeopleChainReady
    .then(chain => {
      if (!cancelled) onResult(chainRegistry.getProvider(chain));
    })
    .catch((error: unknown) => {
      console.error('[statement-store] people chain never resolved — provider inert', error);
    });
  return () => {
    cancelled = true;
  };
});

export const lazyClient = createLazyClient(peopleChainProvider);

// TODO reimplement, we don't do direct rx streams handling here
export const submitError$ = new Subject<Error>();

// `createPapiStatementStoreAdapter` CONNECTS the client eagerly (it calls
// `getRequestFn`). The people chain only exists after bootstrap seeds it, so the
// base adapter — and the reconnect wrapper built on it — are created lazily on
// first use. Importing this module therefore never reads config / connects.
type Adapter = ReturnType<typeof createPapiStatementStoreAdapter>;

let baseAdapter: Adapter | null = null;

function getBaseAdapter(): Adapter {
  baseAdapter ??= createPapiStatementStoreAdapter(lazyClient);
  return baseAdapter;
}

// Re-issue subscriptions on reconnect: a paused/resumed WebSocket leaves the
// substrate-client demuxer keyed on the old subscription id, so notifications
// silently go missing until reload.
let reconnectAware: ReturnType<typeof createReconnectAwareSubscribe> | null = null;

function getReconnectAware(): ReturnType<typeof createReconnectAwareSubscribe> {
  reconnectAware ??= createReconnectAwareSubscribe({
    inner: (filter, callback) => getBaseAdapter().subscribeStatements(filter, callback),
    // Same race as the provider — register now if seeded, else defer.
    onStatusChanged: cb => {
      if (activePeopleChain) {
        return chainRegistry.onStatusChanged(activePeopleChain.genesisHash, cb);
      }
      let detach: VoidFunction | null = null;
      let cancelled = false;
      activePeopleChainReady
        .then(chain => {
          if (!cancelled) detach = chainRegistry.onStatusChanged(chain.genesisHash, cb);
        })
        .catch(() => null);
      return () => {
        cancelled = true;
        detach?.();
      };
    },
  });
  return reconnectAware;
}

export const statementStoreAdapter: Adapter = {
  queryStatements(filter, destination) {
    return getBaseAdapter().queryStatements(filter, destination);
  },
  submitStatement(statement) {
    return getBaseAdapter()
      .submitStatement(statement)
      .mapErr(e => {
        if (shouldSurfaceSubmitError(e)) submitError$.next(e);
        return e;
      });
  },
  subscribeStatements(filter, callback) {
    return getReconnectAware().subscribe(filter, callback);
  },
};

// Manual diagnostic: confirms whether the endpoint URL we're talking to actually
// serves the chain we expect. Reachable from devtools via
// `window.__chainDebug.probe()`.
const probeActiveChain = async (): Promise<{
  endpoint: string;
  configuredGenesisHash: string;
  actualGenesisHash: string | null;
  actualChainName: string | null;
  actualSpecName: string | null;
  match: boolean;
}> => {
  const activeChain = requireActivePeopleChain();
  const endpoint = activeChain.nodes[0]?.url ?? '(none)';
  const configuredGenesisHash = activeChain.genesisHash;
  let actualGenesisHash: string | null = null;
  let actualChainName: string | null = null;
  let actualSpecName: string | null = null;
  try {
    const client = lazyClient.getClient();
    const specData = await client.getChainSpecData();
    actualGenesisHash = specData.genesisHash;
    actualChainName = specData.name;
    const api = client.getUnsafeApi();
    try {
      const version = await api.constants['System']?.['Version']?.();
      if (version && typeof version === 'object' && 'spec_name' in version) {
        actualSpecName = String(version.spec_name);
      }
    } catch {
      // System.Version constant unavailable — non-fatal for chainId verification.
    }
  } catch (e) {
    console.warn('[chain-diag] probe failed', e);
  }
  return {
    endpoint,
    configuredGenesisHash,
    actualGenesisHash,
    actualChainName,
    actualSpecName,
    match: actualGenesisHash !== null && actualGenesisHash === configuredGenesisHash,
  };
};

if (typeof window !== 'undefined') {
  // Getters so the config read stays lazy (Remote Config isn't ready at import).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/consistent-type-assertions -- debug surface
  (window as any).__chainDebug = {
    probe: probeActiveChain,
    get endpoint() {
      return requireActivePeopleChain().nodes[0]?.url ?? '(none)';
    },
    get configuredChainId() {
      return requireActivePeopleChain().chainId;
    },
    get configuredGenesisHash() {
      return requireActivePeopleChain().genesisHash;
    },
    get configuredName() {
      return requireActivePeopleChain().name;
    },
  };
}
