import { bundledStacks, environmentsConfig } from './constants';
import { type BundledStack, type DigitalDollarAsset, type Environment, type EnvironmentId } from './types';

function isEnvironmentId(value: unknown): value is EnvironmentId {
  return typeof value === 'string' && value in environmentsConfig.channels;
}

// The one validate-and-fall-back rule for an environment id from an untrusted
// source — a persisted blob written by an older build, a deeplink, a config.
// Anything that isn't a known channel resolves to the catalog default.
function toEnvironmentId(value: unknown): EnvironmentId {
  return isEnvironmentId(value) ? value : environmentsConfig.default;
}

// Channel descriptors for the picker — id + display name only.
function list(): Pick<Environment, 'id' | 'name'>[] {
  return Object.entries(environmentsConfig.channels).map(([id, channel]) => ({ id, name: channel.name }));
}

// Straight off the compile-time channel catalog, not async Remote Config — the UI
// reads it without waiting for the assembly, so there is no first-render flicker.
// Takes the id rather than resolving it: resolving the active channel is a
// repository read, which a service does not do.
function activeDigitalDollarAsset(id: EnvironmentId): DigitalDollarAsset {
  const channel = environmentsConfig.channels[id];
  if (!channel) throw new Error('[environment] active channel missing from VITE_ENVIRONMENTS');

  return channel.digitalDollarAsset;
}

function isBundledStackName(name: string): name is keyof typeof bundledStacks {
  return Object.hasOwn(bundledStacks, name);
}

function bundledStack(name: string): BundledStack {
  if (!isBundledStackName(name)) throw new Error(`[environment] stack "${name}" is not bundled in .trinity/`);

  return bundledStacks[name];
}

function stackOf(id: EnvironmentId): BundledStack {
  const channel = environmentsConfig.channels[id];
  if (!channel) throw new Error(`[environment] channel "${id}" missing from VITE_ENVIRONMENTS`);

  return bundledStack(channel.stack);
}

export const environmentService = {
  list,
  isEnvironmentId,
  toEnvironmentId,
  activeDigitalDollarAsset,
  bundledStack,
  stackOf,
};
