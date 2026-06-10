import * as v from 'valibot';

import { type ChannelConfig, type EnvironmentsConfig, channelConfigSchema, rawEnvironmentsConfigSchema } from './schemas';

// Build-time channel catalog from `VITE_ENVIRONMENTS`. Read eagerly (not injected)
// because it must be available synchronously at module init — network-settings
// reads the active channel id before React mounts. No fallback: the app refuses to
// start without a valid catalog.
function readEnvironmentsConfig(): EnvironmentsConfig {
  const raw = import.meta.env['VITE_ENVIRONMENTS'];
  if (!raw) {
    throw new Error('[environment] VITE_ENVIRONMENTS is not set — no environment catalog available');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`[environment] VITE_ENVIRONMENTS is not valid JSON: ${String(error)}`);
  }

  const { default: defaultId, shared, channels } = v.parse(rawEnvironmentsConfigSchema, parsed);

  // Merge `shared` defaults under each channel, then validate completeness.
  const resolved: Record<string, ChannelConfig> = {};
  for (const [id, channel] of Object.entries(channels)) {
    resolved[id] = v.parse(channelConfigSchema, { ...shared, ...channel });
  }

  if (!(defaultId in resolved)) {
    throw new Error(`[environment] VITE_ENVIRONMENTS "default" ("${defaultId}") is not a defined channel`);
  }

  return { default: defaultId, channels: resolved };
}

export const environmentsConfig = readEnvironmentsConfig();
