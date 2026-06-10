import { type HexString } from '@novasamatech/scale';

import { chainService, getChains } from '@/domains/network';
import { REMOTE_CONFIG_KEYS, remoteConfigGateway, remoteUrlSchema } from '@/domains/remote-config';
import { environmentService } from '../environment';
import { environmentsConfig } from '../environment/config';
import { dotNsConfigSchema } from '../environment/schemas';
import { type Environment, type EnvironmentId } from '../environment/types';

// Assembles the active `Environment`. Channel-shaped values come from
// `VITE_ENVIRONMENTS`; chains come from the network domain's single
// `chainResource` (NOT a second chains_v2 parse) resolved by role; the remaining
// scalars (dotNS / ipfs / identity) from the Remote Config gateway. There is no
// bundled fallback — it throws if a required piece is missing (the async
// bootstrap awaits readiness before any consumer reads config).

function ensure0x(address: string): HexString {
  return `0x${address.replace(/^0x/i, '')}`;
}

// Cached per channel: Remote Config activates once at bootstrap, so the snapshot
// is stable for the session — a channel switch goes through a reload.
const cache = new Map<EnvironmentId, Environment>();

async function assemble(id: EnvironmentId): Promise<Environment> {
  const channel = environmentsConfig.channels[id];
  if (!channel) throw new Error(`[environment] unknown channel "${id}" (not in VITE_ENVIRONMENTS)`);
  const roles = channel.roles;

  // Single source of truth: the chain catalog shared with every UI chain list.
  // Throws if Remote Config's `chains_v2` is unavailable.
  const chains = await getChains();

  const peopleChain = chainService.findRemoteChain(chains, roles.people);
  const bulletinChain = chainService.findRemoteChain(chains, roles.bulletin);
  const dotnsChain = chainService.findRemoteChain(chains, roles.assetHub);
  if (!peopleChain || !bulletinChain || !dotnsChain) {
    throw new Error(`[environment] Remote Config chains for "${id}" are missing a role (people/bulletin/assetHub)`);
  }

  const dotNs = remoteConfigGateway.tryGetJson(REMOTE_CONFIG_KEYS.dotNsConfig, dotNsConfigSchema);
  const ipfsGatewayUrl = remoteConfigGateway.tryGetString(REMOTE_CONFIG_KEYS.ipfsGatewayUrl, remoteUrlSchema);
  const backendUrl = remoteConfigGateway.tryGetString(REMOTE_CONFIG_KEYS.identityBackendUrl, remoteUrlSchema);
  if (!dotNs || !ipfsGatewayUrl || !backendUrl) {
    throw new Error(`[environment] Remote Config scalars (dotNS/ipfs/identity) unavailable for "${id}"`);
  }

  return {
    id,
    name: channel.name,
    peopleChain,
    bulletinChain,
    bulletinHopEndpoints: bulletinChain.externalApi?.hop ?? [],
    dotnsChain,
    dotnsContentResolverContract: ensure0x(dotNs.resolverContractAddress),
    dotnsRegistryContract: ensure0x(dotNs.registryContractAddress),
    // RC stores the identity backend with a trailing slash; consumers append
    // `/api/...`, so normalize it off.
    backendUrl: backendUrl.replace(/\/+$/, ''),
    iosBundleId: channel.iosBundleId,
    ipfsGatewayUrl: ipfsGatewayUrl.replace(/\/+$/, ''),
    botNetwork: channel.botNetwork,
    hostChatNetwork: channel.hostChatNetwork,
    digitalDollarAsset: channel.digitalDollarAsset,
  };
}

// Always async: `assemble` awaits Remote Config readiness (via `getChains`) before
// reading config (resolves instantly on a warm cache / once the first fetch settled).
async function getById(id: EnvironmentId): Promise<Environment> {
  const cached = cache.get(id);
  if (cached) return cached;

  const env = await assemble(id);
  cache.set(id, env);
  return env;
}

function getActive(): Promise<Environment> {
  return getById(environmentService.getActiveId());
}

export const environmentUseCase = { getActive, getById };
