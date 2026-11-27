import { type ChainStatus } from '../monitor/types';

export type NetworkHealth = 'connected' | 'syncing' | 'unstable' | 'offline' | 'unused' | 'unreachable';

export type LiveVerdict = {
  readonly health: Exclude<NetworkHealth, 'offline'>;
  // The genesis hashes of the chains behind an `unstable` verdict.
  readonly slow?: readonly string[];
};

export type NetworkStatus = {
  readonly chains: readonly ChainStatus[];
  readonly readAt: number;
  readonly verdict: LiveVerdict;
};

export type ChainHealthFacts = {
  // Since `NetworkStatus.readAt`, so a chain's last block ages between reads.
  sinceRead: number;
  // Whether the verdict names this chain slow.
  behind: boolean;
  offline: boolean;
  // Whether the verdict finds the whole network out of reach.
  unreachable: boolean;
};

export type ChainHealth =
  | { kind: 'offline' }
  | { kind: 'noEndpoint'; networkUnreachable: boolean }
  | { kind: 'unused' }
  | { kind: 'disconnected' }
  | { kind: 'syncing'; syncShare: number | null; sinceLast: number | null }
  | { kind: 'connecting'; sinceLast: number | null }
  | { kind: 'stalled'; behind: boolean; sinceLast: number }
  // `liveShare` is the chain's block time over its measured one, capped at 1. Null until two intervals are measured.
  | { kind: 'producing'; behind: boolean; sinceLast: number | null; liveShare: number | null };
