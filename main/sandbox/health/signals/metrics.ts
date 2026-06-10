import { type HealthSignal } from '../types';

export type MetricsAttachInput = {
  webContentsId: number;
  webContents: { getOSProcessId: () => number; isDestroyed: () => boolean };
  visible: boolean;
};

export type ProcessMetricLike = {
  pid: number;
  cpu: { percentCPUUsage: number };
  memory: { workingSetSize: number }; // kB
};

export type MetricsConfig = {
  intervalMs: number;
  memoryCeilingMb: number;
  memoryDegradedMb: number;
  cpuPinnedThresholdPct: number;
  getAppMetrics: () => ProcessMetricLike[];
  emit: (webContentsId: number, signal: HealthSignal) => void;
};

export type MetricsCollector = {
  attach: (input: MetricsAttachInput) => void;
  detach: (webContentsId: number) => void;
  setVisible: (webContentsId: number, visible: boolean) => void;
  stop: () => void;
};

export function createMetricsCollector(config: MetricsConfig): MetricsCollector {
  const entries = new Map<number, { webContents: MetricsAttachInput['webContents']; visible: boolean }>();

  function tick() {
    let anyVisible = false;
    for (const entry of entries.values()) {
      if (entry.visible && !entry.webContents.isDestroyed()) {
        anyVisible = true;
        break;
      }
    }
    if (!anyVisible) return;
    const metrics = config.getAppMetrics();
    const byPid = new Map<number, ProcessMetricLike>();
    for (const m of metrics) byPid.set(m.pid, m);

    for (const [id, entry] of entries) {
      if (!entry.visible) continue;
      if (entry.webContents.isDestroyed()) {
        entries.delete(id);
        continue;
      }
      let pid = 0;
      try {
        pid = entry.webContents.getOSProcessId();
      } catch {
        // not ready yet
      }
      if (!pid) continue;
      const m = byPid.get(pid);
      if (!m) continue;
      const memMb = m.memory.workingSetSize / 1024;
      const cpuPct = m.cpu.percentCPUUsage;
      if (memMb >= config.memoryCeilingMb) {
        config.emit(id, { source: 'metrics', verdict: 'degrade', reason: { kind: 'memory-ceiling' } });
        continue;
      }
      if (memMb >= config.memoryDegradedMb) {
        config.emit(id, { source: 'metrics', verdict: 'degrade', reason: { kind: 'memory-degraded' } });
        continue;
      }
      if (cpuPct >= config.cpuPinnedThresholdPct) {
        config.emit(id, { source: 'metrics', verdict: 'degrade', reason: { kind: 'cpu-pinned' } });
        continue;
      }
      config.emit(id, { source: 'metrics', verdict: 'good', reason: { kind: 'recovered' } });
    }
  }

  const timer = setInterval(tick, config.intervalMs);

  return {
    attach(input) {
      entries.set(input.webContentsId, { webContents: input.webContents, visible: input.visible });
    },
    detach(id) {
      entries.delete(id);
    },
    setVisible(id, visible) {
      const e = entries.get(id);
      if (e) e.visible = visible;
    },
    stop() {
      clearInterval(timer);
      entries.clear();
    },
  };
}
