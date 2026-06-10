// Cadence
export const HEARTBEAT_INTERVAL_MS = 1_000;
export const METRICS_INTERVAL_MS = 3_000;

// Heartbeat / RTT
export const HEARTBEAT_RTT_DEGRADED_MS = 500;
export const HEARTBEAT_TIMEOUT_MS = 5_000;
export const HEARTBEAT_MISSED_TO_UNRESPONSIVE = 5;

// Metrics
export const MEMORY_CEILING_MB = 1_500;
export const MEMORY_DEGRADED_MB = 1_000;
export const CPU_PINNED_THRESHOLD_PCT = 90;
export const CPU_PINNED_SAMPLES = 4;

// Hysteresis
export const DEGRADE_CONSECUTIVE_SAMPLES = 3;
export const RECOVER_CONSECUTIVE_SAMPLES = 3;

// Visibility
export const WARMUP_SAMPLES_AFTER_VISIBLE = 3;
export const INITIAL_VISIBILITY_TIMEOUT_MS = 5_000;
