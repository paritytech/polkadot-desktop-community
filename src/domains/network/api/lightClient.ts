import init, { type ChainProviderHandle, type Connection, ChainProviderBuilder, setLogLevel } from '@parity/truapi-provider';
import wasmUrl from '@parity/truapi-provider/truapi_provider_bg.wasm?url';
import { type JsonRpcProvider } from '@polkadot-api/json-rpc-provider';

import { isDev } from '@/shared/env';
import { appActive$ } from '@/shared/utils';
import { type GenesisHash } from '../chain/types';
import { connectionRepository } from '../connection/repository';
import { connectionService } from '../connection/service';

import { lightClientRepository } from './repository';
import { type ConnectionStatus } from './types';

// Overrides the console verbosity of the embedded provider and smoldot. A
// release build is silent by default, which leaves a light-client problem in the
// field with nothing to look at; setting this key and reloading makes it talk
// without shipping a new build.
const LOG_LEVEL_OVERRIDE_KEY = 'polkadot:light-client-log';

// The networks truapi-provider bundles a chain-spec catalog for. `addNetwork`
// throws for anything else and names what it does carry, so a package bump that
// reshapes the catalog announces itself in the log instead of silently dropping
// light-client support.
const BUNDLED_NETWORKS = ['previewnet', 'paseo-next-v2'];

// Genesis hashes the bundled catalog can serve, lowercased. Empty until a boot
// or the settings screen loads the catalog, so `hasLightClientSupport` reports
// nothing supported before then.
let supportedGenesisHashes: ReadonlySet<string> = new Set();

// Chains a connection has been opened for this run. Only these have a smoldot
// database worth snapshotting — an RPC-mode chain has none at all.
const connectedGenesisHashes = new Set<string>();

// Long enough that a full round trip per chain is not a recurring cost, short enough
// that an ordinary session stores something before it ends.
const DATABASE_SAVE_INTERVAL_MS = 5 * 60 * 1000;

let handlePromise: Promise<ChainProviderHandle> | null = null;
let saveLoop: ReturnType<typeof setInterval> | null = null;

// `error` | `warn` | `info` | `debug` | `trace`; anything else disables output.
function providerLogLevel(): string {
  try {
    const override = sessionStorage.getItem(LOG_LEVEL_OVERRIDE_KEY);
    if (override) return override;
  } catch {
    // No sessionStorage (or blocked) — fall through to the build default.
  }

  return isDev() ? 'info' : 'off';
}

async function buildHandle(): Promise<ChainProviderHandle> {
  await init({ module_or_path: wasmUrl });
  setLogLevel(providerLogLevel());

  const builder = new ChainProviderBuilder();

  // Without a store every chain syncs from its chain-spec checkpoint on every run.
  // The provider reads at most once per chain, on that chain's first add.
  builder.setStorage({
    load: (genesisHash: string) => lightClientRepository.load(genesisHash),
    save: (genesisHash: string, blob: string) => lightClientRepository.save(genesisHash, blob),
  });

  const supported = new Set<string>();

  for (const name of BUNDLED_NETWORKS) {
    try {
      // Registering is what enumerates the network — the catalog has no listing
      // API, and the returned hashes are the only honest source for "can this
      // chain run a light client".
      const chains = builder.addNetwork(name);
      for (const hash of [chains.relay, chains.assethub, chains.people, chains.bulletin]) {
        supported.add(hash.toLowerCase());
      }
    } catch (error) {
      console.warn(`[network] truapi-provider has no bundled network "${name}"`, error);
    }
  }

  supportedGenesisHashes = supported;

  return builder.build();
}

function getHandle(): Promise<ChainProviderHandle> {
  handlePromise ??= buildHandle().catch((error: unknown) => {
    // Drop the cached promise so a later attempt retries instead of handing the
    // same dead rejection to every caller forever.
    handlePromise = null;
    throw error;
  });

  return handlePromise;
}

/** Load the catalog, whatever the current mode. Memoized; failure is not fatal. */
export async function ensureLightClientCatalog(): Promise<void> {
  await getHandle();
}

/** Boot path. Skipped on `rpc`, where availability is never consulted. */
export async function initLightClient(): Promise<void> {
  if (!connectionService.mayUseLightClient(connectionRepository.getSettings())) return;

  await getHandle();
  startDatabaseSaveLoop();
}

/**
 * Snapshot each connected light client's finalized state on an interval.
 *
 * Periodic rather than on unload: a snapshot is a full round trip against the light
 * client, and neither `pagehide` nor a hidden tab is guaranteed to stay scheduled long
 * enough to finish one — which is why the provider's own docs say to drive it while
 * the page is alive.
 *
 * Idempotent. Returns a teardown for both handles it retains — the interval and the
 * visibility subscription — matching `initChainConnectionLifecycle`. The boot path
 * discards it, because on this path the loop lives as long as the app does; the
 * teardown exists so a caller that does not own the app's lifetime can stop it.
 */
function startDatabaseSaveLoop(): VoidFunction {
  if (saveLoop) return () => {};

  // `appActive$` replays its latest value on subscribe, so this is current from the
  // first tick. A hidden app is not doing chain work worth snapshotting.
  let active = true;
  const activeSubscription = appActive$.subscribe(value => {
    active = value;
  });

  const interval = setInterval(() => {
    if (!active) return;

    void saveConnectedDatabases();
  }, DATABASE_SAVE_INTERVAL_MS);
  saveLoop = interval;

  return () => {
    clearInterval(interval);
    activeSubscription.unsubscribe();
    saveLoop = null;
  };
}

async function saveConnectedDatabases(): Promise<void> {
  const handle = await getHandle();

  for (const genesisHash of connectedGenesisHashes) {
    // RPC-mode chains reach `connect` too, but have no smoldot database behind them.
    if (!supportedGenesisHashes.has(genesisHash)) continue;

    try {
      // `false` means the chain has finalized nothing yet — the sanctioned skip, not
      // a failure.
      await handle.saveDatabase(genesisHash);
    } catch (error) {
      // One chain's snapshot failing must not stop the others.
      console.warn(`[network] could not store light-client state for ${genesisHash}`, error);
    }
  }
}

export function hasLightClientSupport(chainId: GenesisHash): boolean {
  return supportedGenesisHashes.has(chainId.toLowerCase());
}

/**
 * A `JsonRpcProvider` backed by truapi-provider's embedded smoldot, one shared
 * instance across every chain. Status is reported around `connect` rather than
 * pinned to `connected` up front: a cold start spends its time there, and
 * claiming `connected` through it leaves the UI unable to tell a warming light
 * client from a healthy one — which is what the "switch to RPC" prompt keys off.
 */
export function createLightClientProvider(
  chainId: GenesisHash,
  onStatusChanged: (status: ConnectionStatus) => void,
  onHalt: (error?: unknown) => void,
): JsonRpcProvider {
  return onMessage => {
    // Held on an object so control-flow analysis does not narrow the flag across
    // the `connect` await — `disconnect` can flip it at any point.
    const state: { connection: Connection | null; closed: boolean } = { connection: null, closed: false };
    const queued: string[] = [];

    onStatusChanged('connecting');

    void (async () => {
      try {
        const handle = await getHandle();

        // Seed the finalized state stored by a previous run, so this client resumes
        // instead of syncing from the chain-spec checkpoint. Best-effort: a failure
        // here costs a cold sync, and must not stop the connection.
        await handle.loadDatabase(chainId).catch((error: unknown) => {
          console.warn(`[network] could not restore light-client state for ${chainId}`, error);
        });

        const connection = await handle.connect(chainId);
        connectedGenesisHashes.add(chainId);

        if (state.closed) {
          connection.close();
          return;
        }

        state.connection = connection;
        onStatusChanged('connected');

        for (const message of queued) {
          connection.send(message);
        }
        queued.length = 0;

        // Draining is not optional: frames queue until taken, and once the
        // backlog hits the connection's budget further sends come back as
        // JSON-RPC errors instead of being queued.
        for (;;) {
          const response = await connection.nextResponse();
          if (response === undefined) break;

          onMessage(JSON.parse(response));
        }

        // The connection ended; the halt hands the retry to the pool, which
        // rebuilds the lane on its backoff.
        if (!state.closed) {
          onStatusChanged('disconnected');
          onHalt();
        }
      } catch (error) {
        console.error(`[network] light client failed for ${chainId}`, error);
        onStatusChanged('disconnected');
        // A refused connect (such as one past the 32-connection cap) lands here. Without the
        // halt the lane would stay dead for good; `disconnect` closing the connection must not halt.
        if (!state.closed) onHalt(error);
      }
    })();

    return {
      send(message) {
        if (state.closed) return;

        const raw = JSON.stringify(message);
        if (state.connection) {
          state.connection.send(raw);
        } else {
          queued.push(raw);
        }
      },
      disconnect() {
        state.closed = true;
        state.connection?.close();
        state.connection = null;
      },
    };
  };
}
