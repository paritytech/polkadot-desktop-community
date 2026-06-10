import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type HealthSignal } from '../types';

import { createMetricsCollector } from './metrics';

function fakeWC(pid: number) {
  return {
    getOSProcessId: () => pid,
    isDestroyed: () => false,
  };
}

describe('metrics collector', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('emits good when memory and cpu are under thresholds', () => {
    const signals: { id: number; sig: HealthSignal }[] = [];
    const c = createMetricsCollector({
      intervalMs: 50,
      memoryCeilingMb: 1500,
      memoryDegradedMb: 1000,
      cpuPinnedThresholdPct: 90,
      getAppMetrics: () => [{ pid: 100, cpu: { percentCPUUsage: 20 }, memory: { workingSetSize: 500_000 } }],
      emit: (id, sig) => signals.push({ id, sig }),
    });
    c.attach({ webContentsId: 1, webContents: fakeWC(100), visible: true });
    vi.advanceTimersByTime(50);
    expect(signals).toContainEqual({ id: 1, sig: { source: 'metrics', verdict: 'good', reason: { kind: 'recovered' } } });
  });

  it('emits degrade with memory-ceiling when over hard ceiling', () => {
    const signals: HealthSignal[] = [];
    const c = createMetricsCollector({
      intervalMs: 50,
      memoryCeilingMb: 1500,
      memoryDegradedMb: 1000,
      cpuPinnedThresholdPct: 90,
      getAppMetrics: () => [{ pid: 100, cpu: { percentCPUUsage: 5 }, memory: { workingSetSize: 1_600_000 } }],
      emit: (_, sig) => signals.push(sig),
    });
    c.attach({ webContentsId: 1, webContents: fakeWC(100), visible: true });
    vi.advanceTimersByTime(50);
    expect(signals[0]!.reason.kind).toBe('memory-ceiling');
  });

  it('emits degrade with memory-degraded between soft and hard thresholds', () => {
    const signals: HealthSignal[] = [];
    const c = createMetricsCollector({
      intervalMs: 50,
      memoryCeilingMb: 1500,
      memoryDegradedMb: 1000,
      cpuPinnedThresholdPct: 90,
      getAppMetrics: () => [{ pid: 100, cpu: { percentCPUUsage: 5 }, memory: { workingSetSize: 1_200_000 } }],
      emit: (_, sig) => signals.push(sig),
    });
    c.attach({ webContentsId: 1, webContents: fakeWC(100), visible: true });
    vi.advanceTimersByTime(50);
    expect(signals[0]!.reason.kind).toBe('memory-degraded');
  });

  it('emits degrade with cpu-pinned when over cpu threshold', () => {
    const signals: HealthSignal[] = [];
    const c = createMetricsCollector({
      intervalMs: 50,
      memoryCeilingMb: 1500,
      memoryDegradedMb: 1000,
      cpuPinnedThresholdPct: 90,
      getAppMetrics: () => [{ pid: 100, cpu: { percentCPUUsage: 95 }, memory: { workingSetSize: 100_000 } }],
      emit: (_, sig) => signals.push(sig),
    });
    c.attach({ webContentsId: 1, webContents: fakeWC(100), visible: true });
    vi.advanceTimersByTime(50);
    expect(signals[0]!.reason.kind).toBe('cpu-pinned');
  });

  it('does not emit for hidden entries', () => {
    const signals: HealthSignal[] = [];
    const c = createMetricsCollector({
      intervalMs: 50,
      memoryCeilingMb: 1500,
      memoryDegradedMb: 1000,
      cpuPinnedThresholdPct: 90,
      getAppMetrics: () => [{ pid: 100, cpu: { percentCPUUsage: 95 }, memory: { workingSetSize: 100_000 } }],
      emit: (_, sig) => signals.push(sig),
    });
    c.attach({ webContentsId: 1, webContents: fakeWC(100), visible: false });
    vi.advanceTimersByTime(50);
    expect(signals.length).toBe(0);
  });

  it('does not emit when pid not found in metrics', () => {
    const signals: HealthSignal[] = [];
    const c = createMetricsCollector({
      intervalMs: 50,
      memoryCeilingMb: 1500,
      memoryDegradedMb: 1000,
      cpuPinnedThresholdPct: 90,
      getAppMetrics: () => [],
      emit: (_, sig) => signals.push(sig),
    });
    c.attach({ webContentsId: 1, webContents: fakeWC(100), visible: true });
    vi.advanceTimersByTime(50);
    expect(signals.length).toBe(0);
  });

  it('skips entry when getOSProcessId returns 0 (pid not ready)', () => {
    const signals: HealthSignal[] = [];
    const c = createMetricsCollector({
      intervalMs: 50,
      memoryCeilingMb: 1500,
      memoryDegradedMb: 1000,
      cpuPinnedThresholdPct: 90,
      getAppMetrics: () => [{ pid: 100, cpu: { percentCPUUsage: 5 }, memory: { workingSetSize: 100_000 } }],
      emit: (_, sig) => signals.push(sig),
    });
    c.attach({ webContentsId: 1, webContents: fakeWC(0), visible: true });
    vi.advanceTimersByTime(50);
    expect(signals.length).toBe(0);
  });

  it('starts emitting once getOSProcessId becomes non-zero', () => {
    let currentPid = 0;
    const signals: HealthSignal[] = [];
    const c = createMetricsCollector({
      intervalMs: 50,
      memoryCeilingMb: 1500,
      memoryDegradedMb: 1000,
      cpuPinnedThresholdPct: 90,
      getAppMetrics: () => [{ pid: 100, cpu: { percentCPUUsage: 5 }, memory: { workingSetSize: 100_000 } }],
      emit: (_, sig) => signals.push(sig),
    });
    c.attach({
      webContentsId: 1,
      webContents: { getOSProcessId: () => currentPid, isDestroyed: () => false },
      visible: true,
    });
    vi.advanceTimersByTime(50);
    expect(signals.length).toBe(0);
    currentPid = 100;
    vi.advanceTimersByTime(50);
    expect(signals.some(s => s.verdict === 'good')).toBe(true);
  });
});
