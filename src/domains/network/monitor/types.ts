import { type ConnectionStatus } from '../api/types';
import { type Chain } from '../chain/types';

export type { ChainLifecycle } from '@parity/truapi-provider';

export type ChainRole = 'relay' | 'assetHub' | 'bulletin' | 'people';

export type BlockHealth = 'onTime' | 'late' | 'veryLate';

export type BlockBar = {
  readonly number: number;
  readonly health: BlockHealth;
  // Since the previous block arrived.
  readonly gapMs: number;
};

// How a chain counts toward the verdict. `down` while its pool reports it disconnected.
export type ChainUse = 'unused' | 'pending' | 'down' | 'live';

// A chain's phase as it comes up, or `stalled` once the light client reports it making no progress.
export type ChainPhase = 'connecting' | 'syncing' | 'ready' | 'stalled';

export type KnownChain = { role: ChainRole; chain: Chain };

export type MonitoredChain = {
  readonly chain: Chain;
  // Null for a chain outside the known roles.
  readonly role: ChainRole | null;
  readonly blockTimeMs: number;
  // Oldest first.
  readonly bars: readonly BlockBar[];
  readonly latest: number | null;
  // When the last block counted toward the bars arrived. Null while the block clock is stopped.
  readonly lastAt: number | null;
  readonly consumers: number;
  readonly status: ConnectionStatus;
  readonly following: boolean;
  // The light client's last report. These three outlive a release: the light client keeps its chains whether or not
  // the app holds them.
  readonly phase: ChainPhase | null;
  readonly syncShare: number | null;
  readonly peers: number | null;
};

// Keyed by lowercase genesis hash. `known` in role order, `extras` in the order first held.
export type NetworkMonitorModel = {
  readonly known: ReadonlyMap<string, MonitoredChain>;
  readonly extras: ReadonlyMap<string, MonitoredChain>;
};

export type ChainStatus = {
  readonly genesisHash: string;
  readonly role: ChainRole | null;
  readonly name: string;
  readonly bars: readonly BlockBar[];
  readonly latest: number | null;
  readonly sinceLast: number | null;
  readonly blockTimeMs: number;
  // False when the active network offers no endpoint for a known chain.
  readonly reachable: boolean;
  // A chain can be `ready` before any block is observed.
  readonly phase: ChainPhase | null;
  // The share of its last warp the light client proved, kept after the warp. Null before any.
  readonly syncShare: number | null;
  // Null where the backend never reports peers, such as RPC.
  readonly peers: number | null;
  readonly state: ChainUse;
  // True when the light client reports a chain in use stalled. Never set by overdue blocks.
  readonly alarm: boolean;
};

export type ChainClock = Pick<
  ChainStatus,
  'genesisHash' | 'latest' | 'sinceLast' | 'blockTimeMs' | 'reachable' | 'state' | 'alarm'
>;
