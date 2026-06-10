import { type WebContents } from 'electron';

import { type HeartbeatCollector, createHeartbeatCollector } from './signals/heartbeat';
import { type MetricsCollector, type ProcessMetricLike, createMetricsCollector } from './signals/metrics';
import { createNativeEventBinder } from './signals/nativeEvents';
import { initialEntryState, reduce } from './stateMachine';
import { type HealthConfig, type HealthEntryState, type HealthEvent, type HealthSignal } from './types';

export type SandboxHealthMonitor = {
  attach: (input: { webContentsId: number; webContents: WebContents; productId: string | null; visible: boolean }) => void;
  detach: (webContentsId: number) => void;
  setVisible: (webContentsId: number, visible: boolean) => void;
  handlePong: (webContentsId: number, seq: number) => void;
  stop: () => void;
};

export type SandboxHealthMonitorConfig = {
  config: HealthConfig;
  getAppMetrics: () => ProcessMetricLike[];
  now: () => number;
  emit: (event: HealthEvent) => void;
};

type EntryHandle = {
  productId: string | null;
  state: HealthEntryState;
  unbindNative: () => void;
};

export function createSandboxHealthMonitor(deps: SandboxHealthMonitorConfig): SandboxHealthMonitor {
  const entries = new Map<number, EntryHandle>();

  const nativeBinder = createNativeEventBinder();

  function emitTransition(webContentsId: number, productId: string | null, nextState: HealthEntryState) {
    deps.emit({
      webContentsId,
      productId,
      state: nextState.state,
      reason: nextState.reason,
      at: deps.now(),
    });
  }

  function applySignal(webContentsId: number, signal: HealthSignal) {
    const handle = entries.get(webContentsId);
    if (!handle) return;
    const res = reduce(handle.state, signal, deps.config);
    handle.state = res.next;
    if (res.transitioned) emitTransition(webContentsId, handle.productId, res.next);
  }

  const heartbeat: HeartbeatCollector = createHeartbeatCollector({
    intervalMs: deps.config.heartbeatIntervalMs,
    timeoutMs: deps.config.heartbeatTimeoutMs,
    rttDegradedMs: deps.config.heartbeatRttDegradedMs,
    now: deps.now,
    emit: (id, sig) => applySignal(id, sig),
  });

  const metrics: MetricsCollector = createMetricsCollector({
    intervalMs: deps.config.metricsIntervalMs,
    memoryCeilingMb: deps.config.memoryCeilingMb,
    memoryDegradedMb: deps.config.memoryDegradedMb,
    cpuPinnedThresholdPct: deps.config.cpuPinnedThresholdPct,
    getAppMetrics: deps.getAppMetrics,
    emit: (id, sig) => applySignal(id, sig),
  });

  return {
    attach({ webContentsId, webContents, productId, visible }) {
      if (entries.has(webContentsId)) return;
      const state = initialEntryState({ visible });
      const unbindNative = nativeBinder.bind(webContents, webContentsId, sig => applySignal(webContentsId, sig));
      entries.set(webContentsId, { productId, state, unbindNative });
      heartbeat.attach({ webContentsId, webContents, productId, visible });
      metrics.attach({ webContentsId, webContents, visible });
    },
    detach(id) {
      const e = entries.get(id);
      if (!e) return;
      e.unbindNative();
      heartbeat.detach(id);
      metrics.detach(id);
      entries.delete(id);
    },
    setVisible(id, visible) {
      const e = entries.get(id);
      if (!e) return;
      const wasVisible = e.state.visible;
      e.state = { ...e.state, visible };
      if (!wasVisible && visible) {
        // Reset on resume; apply warmup window
        const wasHealthy = e.state.state === 'healthy';
        e.state = {
          ...e.state,
          warmupRemaining: deps.config.warmupSamplesAfterVisible,
          heartbeatGood: 0,
          heartbeatBad: 0,
          metricsGood: 0,
          metricsBad: 0,
          cpuPinnedSamples: 0,
          missedPings: 0,
          state: 'healthy',
          reason: { kind: 'recovered' },
        };
        if (!wasHealthy) emitTransition(id, e.productId, e.state);
      }
      heartbeat.setVisible(id, visible);
      metrics.setVisible(id, visible);
    },
    handlePong(id, seq) {
      heartbeat.handlePong(id, seq);
    },
    stop() {
      for (const [id, e] of entries) {
        e.unbindNative();
        heartbeat.detach(id);
        metrics.detach(id);
      }
      entries.clear();
      heartbeat.stop();
      metrics.stop();
    },
  };
}
