import { environmentsConfig } from './config';
import { SETTINGS_STORAGE_KEY } from './constants';
import { type DigitalDollarAsset, type Environment, type EnvironmentId } from './types';

// Read the raw key directly: `getActiveId()` runs at module init, before the
// storage adapter hydrates.
const LOCAL_STORAGE_VALUE_KEY = `polkadot_${SETTINGS_STORAGE_KEY}_value`;

function isEnvironmentId(value: unknown): value is EnvironmentId {
  return typeof value === 'string' && value in environmentsConfig.channels;
}

function readPersistedId(): EnvironmentId {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_VALUE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && isEnvironmentId(parsed.environmentId)) {
        return parsed.environmentId;
      }
    }
  } catch (e) {
    console.error('[environment] failed to read settings', e);
  }
  return environmentsConfig.default;
}

function getActiveId(): EnvironmentId {
  return readPersistedId();
}

// Channel descriptors for the picker — id + display name only.
function list(): Pick<Environment, 'id' | 'name'>[] {
  return Object.entries(environmentsConfig.channels).map(([id, channel]) => ({ id, name: channel.name }));
}

// Sync `VITE_ENVIRONMENTS` config (not async Remote Config), so UI reads it
// without the assembly — no first-render flicker.
function getActiveDigitalDollarAsset(): DigitalDollarAsset {
  const channel = environmentsConfig.channels[getActiveId()];
  if (!channel) throw new Error('[environment] active channel missing from VITE_ENVIRONMENTS');
  return channel.digitalDollarAsset;
}

export const environmentService = {
  getActiveId,
  list,
  isEnvironmentId,
  getActiveDigitalDollarAsset,
};
