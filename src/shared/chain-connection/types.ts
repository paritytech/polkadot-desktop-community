export type ChainConfig = {
  genesisHash: string;
};

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

/** One chain as the pool holds it, for an observer that must not hold it too. */
export type ChainActivity<C extends ChainConfig> = {
  chain: C;
  /** Leases held: `lockApi` and `getProvider` sessions. The pool's own client is not one. */
  consumers: number;
  status: ConnectionStatus;
  /** True while the pool holds an entry, and so a client following the chain. */
  following: boolean;
};

export type ChainPoolWatcher<C extends ChainConfig> = {
  /** Hears a chain's leases, status or entry change. */
  onActivity(activity: ChainActivity<C>): void;
  /** Hears the number of a held chain's new best block. */
  onBestBlock(genesisHash: string, blockNumber: number): void;
};
