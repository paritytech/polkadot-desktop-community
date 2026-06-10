import { type FirebaseApp, initializeApp } from 'firebase/app';
import { type RemoteConfig, fetchAndActivate, getRemoteConfig, setCustomSignals } from 'firebase/remote-config';
import * as v from 'valibot';

import { REMOTE_CONFIG_FETCH_TIMEOUT_MS, REMOTE_CONFIG_MIN_FETCH_INTERVAL_MS, REMOTE_CONFIG_SIGNAL_KEY } from './constants';
import { firebaseConfigSchema } from './schemas';

// Singleton owned here (wiring), read by the stateless gateway via
// `getRemoteConfigInstance()`. Null until init succeeds; the app ships no bundled
// config, so a null instance makes every `tryGet*` read return null.
let remoteConfig: RemoteConfig | null = null;

let resolveReady: (() => void) | null = null;

// Resolves once the first fetch/activate settles (success OR failure); never
// rejects, so consumers can `await` it before reading.
export const remoteConfigReady: Promise<void> = new Promise(resolve => {
  resolveReady = resolve;
});

export function getRemoteConfigInstance(): RemoteConfig | null {
  return remoteConfig;
}

// Force a fetch/activate past the time-based throttle. Returns `false` if RC is
// disabled; never throws.
export async function refreshRemoteConfig(): Promise<boolean> {
  const initialized = remoteConfig;
  if (!initialized) return false;

  const previousInterval = initialized.settings.minimumFetchIntervalMillis;
  initialized.settings.minimumFetchIntervalMillis = 0;
  try {
    return await fetchAndActivate(initialized);
  } catch (error) {
    console.warn('[remote-config] forced refresh failed — keeping last-activated values', error);
    return false;
  } finally {
    initialized.settings.minimumFetchIntervalMillis = previousInterval;
  }
}

type BootstrapRemoteConfigParams = {
  apiKey: string | undefined;
  projectId: string | undefined;
  appId: string | undefined;
  // Active channel — set as the `environment` custom signal so RC resolves the matching condition.
  environment?: string;
  minimumFetchIntervalMillis?: number;
};

export function bootstrapRemoteConfig(params: BootstrapRemoteConfigParams): void {
  // initializeApp throws on a second call with the default name (hot-reload).
  if (remoteConfig) return;

  const parsed = v.safeParse(firebaseConfigSchema, {
    apiKey: params.apiKey,
    projectId: params.projectId,
    appId: params.appId,
  });
  if (!parsed.success) {
    console.warn('[remote-config] Firebase config missing/invalid — Remote Config disabled, reads will return null/fallback');
    resolveReady?.();
    return;
  }

  let app: FirebaseApp;
  try {
    app = initializeApp(parsed.output);
    remoteConfig = getRemoteConfig(app);
    remoteConfig.settings.minimumFetchIntervalMillis = params.minimumFetchIntervalMillis ?? REMOTE_CONFIG_MIN_FETCH_INTERVAL_MS;
    remoteConfig.settings.fetchTimeoutMillis = REMOTE_CONFIG_FETCH_TIMEOUT_MS;
  } catch (error) {
    console.error('[remote-config] failed to initialize Firebase Remote Config', error);
    remoteConfig = null;
    resolveReady?.();
    return;
  }

  const initialized = remoteConfig;

  // Apply the channel signal BEFORE fetch so the server resolves the matching
  // condition; then fire-and-forget fetch/activate (best-effort).
  const applySignals = params.environment
    ? setCustomSignals(initialized, { [REMOTE_CONFIG_SIGNAL_KEY]: params.environment })
    : Promise.resolve();

  applySignals
    .catch((error: unknown) => {
      console.warn('[remote-config] setCustomSignals failed — fetching with prior signals', error);
    })
    .then(() => fetchAndActivate(initialized))
    .then(activated => {
      console.info(`[remote-config] fetchAndActivate complete (activated=${activated})`);
    })
    .catch((error: unknown) => {
      console.warn('[remote-config] fetchAndActivate failed — using last-activated values or caller fallback', error);
    })
    .finally(() => resolveReady?.());
}
