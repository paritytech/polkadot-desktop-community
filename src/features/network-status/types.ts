import { type ChainHealth, type ChainStatus } from '@/domains/network';

export type StatusTone = 'ok' | 'idle' | 'warn' | 'err';

export type ArcBand = 'plain' | 'warn' | 'err';

export type ChainMark =
  | { kind: 'healthy' }
  | { kind: 'short'; share: number; band: ArcBand }
  | { kind: 'outage' }
  | { kind: 'connecting' }
  | { kind: 'unavailable' }
  | { kind: 'unused' };

export type Duration = { minutes: number; seconds: number };

export type StatusText =
  | { kind: 'noInternet' }
  | { kind: 'noEndpoint' }
  | { kind: 'notInUse' }
  | { kind: 'disconnected' }
  | { kind: 'syncing'; percent: number | null }
  | { kind: 'connecting' }
  | { kind: 'notProducing' }
  | { kind: 'producing'; behind: boolean; live: { percent: number; block: Duration } | null };

export type ChainStatusLine = { text: StatusText; tone: 'warn' | 'err' | null };

export type PendingBar = { phase: 'searching' } | { phase: 'counting' | 'due'; heightPercent: number };

// Seconds as dot.li prints them, without the unit. `late` is null for a block on time.
export type BlockDelay = { gap: string; late: string | null };

// The arc's stroke dash, in the mark's user units.
export type ArcDash = { dash: number; gap: number; offset: number };

export type ChainWithHealth = { chain: ChainStatus; health: ChainHealth };
