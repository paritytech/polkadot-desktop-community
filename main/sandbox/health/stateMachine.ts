import { type HealthConfig, type HealthEntryState, type HealthReason, type HealthSignal, type HealthState } from './types';

export function initialEntryState(opts: { visible: boolean }): HealthEntryState {
  return {
    state: 'healthy',
    reason: { kind: 'recovered' },
    visible: opts.visible,
    warmupRemaining: 0,
    heartbeatGood: 0,
    heartbeatBad: 0,
    metricsGood: 0,
    metricsBad: 0,
    cpuPinnedSamples: 0,
    missedPings: 0,
  };
}

type ReduceResult = { next: HealthEntryState; transitioned: boolean; reason: HealthReason };

function noTransition(prev: HealthEntryState, next: HealthEntryState): ReduceResult {
  return { next, transitioned: false, reason: prev.reason };
}

function transitionTo(next: HealthEntryState, state: HealthState, reason: HealthReason): ReduceResult {
  return { next: { ...next, state, reason }, transitioned: true, reason };
}

function applyVerdict(s: HealthEntryState, signal: HealthSignal): HealthEntryState {
  const out = { ...s };
  if (signal.source === 'heartbeat') {
    if (signal.verdict === 'good') {
      out.heartbeatGood = s.heartbeatGood + 1;
      out.heartbeatBad = 0;
      out.missedPings = 0;
    } else if (signal.verdict === 'degrade') {
      out.heartbeatBad = s.heartbeatBad + 1;
      out.heartbeatGood = 0;
    } else if (signal.verdict === 'unresponsive') {
      out.missedPings = s.missedPings + 1;
    }
  } else if (signal.source === 'metrics') {
    if (signal.verdict === 'good') {
      out.metricsGood = s.metricsGood + 1;
      out.metricsBad = 0;
      out.cpuPinnedSamples = 0;
    } else if (signal.verdict === 'degrade') {
      out.metricsBad = s.metricsBad + 1;
      out.metricsGood = 0;
      if (signal.reason.kind === 'cpu-pinned') {
        out.cpuPinnedSamples = s.cpuPinnedSamples + 1;
      }
    }
  }
  return out;
}

export function reduce(prev: HealthEntryState, signal: HealthSignal, config: HealthConfig): ReduceResult {
  // Terminal: crashed never recovers via signals.
  if (prev.state === 'crashed') {
    return noTransition(prev, prev);
  }

  // Crash is always honored.
  if (signal.verdict === 'crashed') {
    return transitionTo(prev, 'crashed', signal.reason);
  }

  // Visibility gate: drop signals while hidden, but keep visibility-state changes.
  if (!prev.visible) {
    return noTransition(prev, prev);
  }

  // Native unresponsive: immediate, bypasses hysteresis.
  if (signal.source === 'native' && signal.verdict === 'unresponsive') {
    return transitionTo(prev, 'unresponsive', signal.reason);
  }
  // Native responsive: from unresponsive, drop to degraded (recovery hysteresis applies onward).
  if (signal.source === 'native' && signal.verdict === 'responsive') {
    if (prev.state === 'unresponsive') {
      return transitionTo({ ...prev, heartbeatGood: 0, metricsGood: 0 }, 'degraded', signal.reason);
    }
    return noTransition(prev, prev);
  }

  let next = applyVerdict(prev, signal);

  // Warmup window: block degradations while it's active. Decrement on any signal.
  if (next.warmupRemaining > 0) {
    next = { ...next, warmupRemaining: next.warmupRemaining - 1 };
    // Reset bad counters so we don't carry warmup-period evidence forward.
    next = { ...next, heartbeatBad: 0, metricsBad: 0, cpuPinnedSamples: 0 };
    return noTransition(prev, next);
  }

  // Unresponsive via missed pings
  if (next.missedPings >= config.heartbeatMissedToUnresponsive) {
    return transitionTo(next, 'unresponsive', { kind: 'heartbeat-timeout' });
  }

  // CPU pin sustained
  if (next.cpuPinnedSamples >= config.cpuPinnedSamples) {
    if (prev.state === 'healthy') {
      return transitionTo(next, 'degraded', { kind: 'cpu-pinned' });
    }
  }

  // Degrade via per-source hysteresis
  const heartbeatTrip = next.heartbeatBad >= config.degradeConsecutiveSamples;
  const metricsTrip = next.metricsBad >= config.degradeConsecutiveSamples;
  if (prev.state === 'healthy' && (heartbeatTrip || metricsTrip)) {
    return transitionTo(next, 'degraded', signal.reason);
  }

  // Recover via per-source AND on good counters
  const heartbeatHealthy = next.heartbeatGood >= config.recoverConsecutiveSamples;
  const metricsHealthy = next.metricsGood >= config.recoverConsecutiveSamples;
  if (prev.state === 'degraded' && heartbeatHealthy && metricsHealthy) {
    return transitionTo(next, 'healthy', { kind: 'recovered' });
  }
  if (prev.state === 'unresponsive' && heartbeatHealthy && metricsHealthy) {
    return transitionTo(next, 'degraded', { kind: 'recovered' });
  }

  return noTransition(prev, next);
}
