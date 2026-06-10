import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createSandboxHealthMonitor } from './SandboxHealthMonitor';
import { type HealthEvent } from './types';

type FakeWC = {
  id: number;
  isDestroyed: () => boolean;
  send: (channel: string, payload: unknown) => void;
  on: (channel: string, handler: (...args: unknown[]) => void) => void;
  off: (channel: string, handler: (...args: unknown[]) => void) => void;
  getOSProcessId: () => number;
};

function makeFakeWC(id: number, pid = 100): FakeWC {
  return {
    id,
    isDestroyed: () => false,
    send: () => {},
    on: () => {},
    off: () => {},
    getOSProcessId: () => pid,
  };
}

const baseConfig = {
  heartbeatIntervalMs: 100,
  metricsIntervalMs: 100,
  heartbeatRttDegradedMs: 50,
  heartbeatTimeoutMs: 500,
  heartbeatMissedToUnresponsive: 5,
  memoryCeilingMb: 1500,
  memoryDegradedMb: 1000,
  cpuPinnedThresholdPct: 90,
  cpuPinnedSamples: 4,
  degradeConsecutiveSamples: 3,
  recoverConsecutiveSamples: 3,
  warmupSamplesAfterVisible: 3,
  initialVisibilityTimeoutMs: 500,
};

describe('SandboxHealthMonitor', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('emits crashed event when native gone fires', () => {
    const events: HealthEvent[] = [];
    const m = createSandboxHealthMonitor({
      config: baseConfig,
      getAppMetrics: () => [],
      now: () => Date.now(),
      emit: e => events.push(e),
    });
    const wc = makeFakeWC(1);
    let goneHandler: ((e: unknown, d: unknown) => void) | null = null;
    wc.on = (ch, h) => {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      if (ch === 'render-process-gone') goneHandler = h as typeof goneHandler;
    };
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    m.attach({ webContentsId: 1, webContents: wc as unknown as Electron.WebContents, productId: 'p1', visible: true });
    goneHandler!({}, { reason: 'oom', exitCode: 137 });
    expect(events.some(e => e.state === 'crashed' && e.productId === 'p1')).toBe(true);
  });

  it('emits unresponsive event after sustained heartbeat timeouts', () => {
    const events: HealthEvent[] = [];
    let now = 0;
    const m = createSandboxHealthMonitor({
      config: baseConfig,
      getAppMetrics: () => [{ pid: 100, cpu: { percentCPUUsage: 5 }, memory: { workingSetSize: 100_000 } }],
      now: () => now,
      emit: e => events.push(e),
    });
    const wc = makeFakeWC(1);
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    m.attach({ webContentsId: 1, webContents: wc as unknown as Electron.WebContents, productId: 'p1', visible: true });
    // Advance 6 heartbeat intervals; never pong; each tick reaps the previous ping as unresponsive.
    for (let i = 0; i < 6; i++) {
      now += 600; // past timeout each tick
      vi.advanceTimersByTime(100);
    }
    expect(events.some(e => e.state === 'unresponsive')).toBe(true);
  });

  it('does not emit transitions for already-emitted state (idempotency)', () => {
    const events: HealthEvent[] = [];
    const now = 0;
    const m = createSandboxHealthMonitor({
      config: baseConfig,
      getAppMetrics: () => [{ pid: 100, cpu: { percentCPUUsage: 5 }, memory: { workingSetSize: 100_000 } }],
      now: () => now,
      emit: e => events.push(e),
    });
    const wc = makeFakeWC(1);
    let goneHandler: ((e: unknown, d: unknown) => void) | null = null;
    wc.on = (ch, h) => {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      if (ch === 'render-process-gone') goneHandler = h as typeof goneHandler;
    };
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    m.attach({ webContentsId: 1, webContents: wc as unknown as Electron.WebContents, productId: 'p1', visible: true });
    goneHandler!({}, { reason: 'oom', exitCode: 137 });
    goneHandler!({}, { reason: 'oom', exitCode: 137 });
    const crashed = events.filter(e => e.state === 'crashed');
    expect(crashed.length).toBe(1);
  });
});
