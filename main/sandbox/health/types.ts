export type HealthState = 'healthy' | 'degraded' | 'unresponsive' | 'crashed';

export type HealthReason =
  | { kind: 'heartbeat-timeout' }
  | { kind: 'heartbeat-rtt-high' }
  | { kind: 'memory-ceiling' }
  | { kind: 'memory-degraded' }
  | { kind: 'cpu-pinned' }
  | { kind: 'native-unresponsive' }
  | { kind: 'native-responsive' }
  | { kind: 'crashed'; nativeReason: string; exitCode: number }
  | { kind: 'recovered' };

// Per-source verdict for a single sampling event. The state machine combines
// per-source counters; see stateMachine.ts.
export type SignalSource = 'heartbeat' | 'metrics' | 'native';
export type SignalVerdict = 'good' | 'degrade' | 'unresponsive' | 'crashed' | 'responsive';

export type HealthSignal = {
  source: SignalSource;
  verdict: SignalVerdict;
  reason: HealthReason;
};

export type HealthEvent = {
  webContentsId: number;
  productId: string | null;
  state: HealthState;
  reason: HealthReason;
  at: number;
};

export type HealthConfig = {
  heartbeatIntervalMs: number;
  metricsIntervalMs: number;
  heartbeatRttDegradedMs: number;
  heartbeatTimeoutMs: number;
  heartbeatMissedToUnresponsive: number;
  memoryCeilingMb: number;
  memoryDegradedMb: number;
  cpuPinnedThresholdPct: number;
  cpuPinnedSamples: number;
  degradeConsecutiveSamples: number;
  recoverConsecutiveSamples: number;
  warmupSamplesAfterVisible: number;
  initialVisibilityTimeoutMs: number;
};

// Per-entry mutable bookkeeping. The state machine returns the next snapshot of
// this plus a transitioned-state flag.
export type HealthEntryState = {
  state: HealthState;
  reason: HealthReason;
  visible: boolean;
  warmupRemaining: number;
  // Per-source consecutive-good / consecutive-bad counters.
  heartbeatGood: number;
  heartbeatBad: number;
  metricsGood: number;
  metricsBad: number;
  cpuPinnedSamples: number; // separate counter for sustained-CPU criterion
  missedPings: number;
};
