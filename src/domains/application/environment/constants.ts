import paseoNextV2Document from '~trinity/paseo-next-v2.json?raw';
import previewnetDocument from '~trinity/previewnet.json?raw';
import stackLinks from '~trinity/stacks.json';
import * as v from 'valibot';

import { type ChannelConfig, type EnvironmentsConfig, channelConfigSchema, rawEnvironmentsConfigSchema } from './schemas';
import { type BundledStack } from './types';

// localStorage namespace for the network-settings persistence (shared with the
// `network-settings` aggregate). Not environment-specific.
export const SETTINGS_STORAGE_KEY = 'pb:settings';

// The signed stacks `trinity-stack` keeps in `.trinity/`. Keyed by `stacks.json`, so a stack added there without its
// copy imported here fails the typecheck.
export const bundledStacks: Record<keyof typeof stackLinks, BundledStack> = {
  'paseo-next-v2': {
    pointer: stackLinks['paseo-next-v2'],
    descriptor: new TextEncoder().encode(paseoNextV2Document),
  },
  previewnet: { pointer: stackLinks.previewnet, descriptor: new TextEncoder().encode(previewnetDocument) },
};

// Build-time channel catalog from `VITE_ENVIRONMENTS`. Read eagerly (not injected)
// because it must be available synchronously at module init — network-settings
// reads the active channel id before React mounts. No fallback: the app refuses to
// start without a valid catalog. (import.meta.env is a build define + schema
// validation — compile-time computation, not runtime I/O.)
function readEnvironmentsConfig(): EnvironmentsConfig {
  const raw = import.meta.env['VITE_ENVIRONMENTS'];
  if (!raw) {
    throw new Error('[environment] VITE_ENVIRONMENTS is not set — no environment catalog available');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error('[environment] VITE_ENVIRONMENTS is not valid JSON', { cause: error });
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
