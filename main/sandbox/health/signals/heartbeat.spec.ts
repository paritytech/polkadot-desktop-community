import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type HealthSignal } from '../types';

import { createHeartbeatCollector } from './heartbeat';

type FakeWC = {
  id: number;
  isDestroyed: () => boolean;
  send: (channel: string, payload: unknown) => void;
};

function makeFakeWC(id: number, onSend: (channel: string, seq: number) => void): FakeWC {
  return {
    id,
    isDestroyed: () => false,
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    send: (channel, payload) => onSend(channel, payload as number),
  };
}

describe('heartbeat collector', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('sends ping on every interval tick to visible entries', () => {
    const sends: { id: number; seq: number }[] = [];
    const c = createHeartbeatCollector({
      intervalMs: 100,
      timeoutMs: 500,
      rttDegradedMs: 50,
      now: () => Date.now(),
      emit: () => {},
    });
    const wc = makeFakeWC(1, (_ch, seq) => sends.push({ id: 1, seq }));
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    c.attach({ webContentsId: 1, webContents: wc as unknown as Electron.WebContents, productId: null, visible: true });
    vi.advanceTimersByTime(250);
    expect(sends.length).toBe(2);
    expect(sends[0]!.seq).toBe(1);
    expect(sends[1]!.seq).toBe(2);
  });

  it('emits good signal with rtt when matching pong arrives', () => {
    const signals: HealthSignal[] = [];
    let now = 0;
    const c = createHeartbeatCollector({
      intervalMs: 100,
      timeoutMs: 500,
      rttDegradedMs: 50,
      now: () => now,
      emit: (_id, sig) => signals.push(sig),
    });
    const wc = makeFakeWC(1, () => {});
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    c.attach({ webContentsId: 1, webContents: wc as unknown as Electron.WebContents, productId: null, visible: true });
    now = 0;
    vi.advanceTimersByTime(100);
    now = 30;
    c.handlePong(1, 1);
    expect(signals.some(s => s.verdict === 'good' && s.source === 'heartbeat')).toBe(true);
  });

  it('emits degrade when rtt exceeds threshold', () => {
    const signals: HealthSignal[] = [];
    let now = 0;
    const c = createHeartbeatCollector({
      intervalMs: 100,
      timeoutMs: 500,
      rttDegradedMs: 50,
      now: () => now,
      emit: (_id, sig) => signals.push(sig),
    });
    const wc = makeFakeWC(1, () => {});
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    c.attach({ webContentsId: 1, webContents: wc as unknown as Electron.WebContents, productId: null, visible: true });
    vi.advanceTimersByTime(100); // seq=1 at now=0
    now = 200; // rtt 200ms
    c.handlePong(1, 1);
    expect(signals.some(s => s.verdict === 'degrade' && s.reason.kind === 'heartbeat-rtt-high')).toBe(true);
  });

  it('reaper emits unresponsive verdict when ping exceeds timeout', () => {
    const signals: HealthSignal[] = [];
    let now = 0;
    const c = createHeartbeatCollector({
      intervalMs: 100,
      timeoutMs: 500,
      rttDegradedMs: 50,
      now: () => now,
      emit: (_id, sig) => signals.push(sig),
    });
    const wc = makeFakeWC(1, () => {});
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    c.attach({ webContentsId: 1, webContents: wc as unknown as Electron.WebContents, productId: null, visible: true });
    vi.advanceTimersByTime(100); // seq=1 at now=0
    now = 600; // past timeout
    vi.advanceTimersByTime(100); // tick 2: reaper runs
    expect(signals.some(s => s.verdict === 'unresponsive' && s.reason.kind === 'heartbeat-timeout')).toBe(true);
  });

  it('skips ping when entry is not visible', () => {
    const sends: number[] = [];
    const c = createHeartbeatCollector({
      intervalMs: 100,
      timeoutMs: 500,
      rttDegradedMs: 50,
      now: () => Date.now(),
      emit: () => {},
    });
    const wc = makeFakeWC(1, (_, seq) => sends.push(seq));
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    c.attach({ webContentsId: 1, webContents: wc as unknown as Electron.WebContents, productId: null, visible: false });
    vi.advanceTimersByTime(300);
    expect(sends.length).toBe(0);
  });

  it('drops stale seq replies', () => {
    const signals: HealthSignal[] = [];
    const now = 0;
    const c = createHeartbeatCollector({
      intervalMs: 100,
      timeoutMs: 500,
      rttDegradedMs: 50,
      now: () => now,
      emit: (_id, sig) => signals.push(sig),
    });
    const wc = makeFakeWC(1, () => {});
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    c.attach({ webContentsId: 1, webContents: wc as unknown as Electron.WebContents, productId: null, visible: true });
    vi.advanceTimersByTime(100); // seq=1
    vi.advanceTimersByTime(100); // seq=2 — seq=1 is now stale
    signals.length = 0;
    c.handlePong(1, 1); // stale
    expect(signals.length).toBe(0);
  });

  it('detach stops scheduling for the entry', () => {
    const sends: number[] = [];
    const c = createHeartbeatCollector({
      intervalMs: 100,
      timeoutMs: 500,
      rttDegradedMs: 50,
      now: () => Date.now(),
      emit: () => {},
    });
    const wc = makeFakeWC(1, (_, seq) => sends.push(seq));
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    c.attach({ webContentsId: 1, webContents: wc as unknown as Electron.WebContents, productId: null, visible: true });
    vi.advanceTimersByTime(100);
    c.detach(1);
    vi.advanceTimersByTime(300);
    expect(sends.length).toBe(1);
  });
});
