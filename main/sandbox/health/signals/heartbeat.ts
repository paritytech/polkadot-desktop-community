import { type WebContents } from 'electron';

import { type HealthSignal } from '../types';

export type HeartbeatAttachInput = {
  webContentsId: number;
  webContents: WebContents;
  productId: string | null;
  visible: boolean;
};

export type HeartbeatConfig = {
  intervalMs: number;
  timeoutMs: number;
  rttDegradedMs: number;
  now: () => number;
  emit: (webContentsId: number, signal: HealthSignal) => void;
};

type Entry = {
  webContents: WebContents;
  productId: string | null;
  visible: boolean;
  seq: number;
  outstandingSeq: number | null;
  outstandingSentAt: number | null;
};

export type HeartbeatCollector = {
  attach: (input: HeartbeatAttachInput) => void;
  detach: (webContentsId: number) => void;
  setVisible: (webContentsId: number, visible: boolean) => void;
  handlePong: (webContentsId: number, seq: number) => void;
  stop: () => void;
};

const HEARTBEAT_CHANNEL = 'sandbox:ping';

export function createHeartbeatCollector(config: HeartbeatConfig): HeartbeatCollector {
  const entries = new Map<number, Entry>();

  function tick() {
    const now = config.now();
    for (const [id, entry] of entries) {
      if (entry.webContents.isDestroyed()) {
        entries.delete(id);
        continue;
      }
      // Reaper: if there's an outstanding ping past timeout, emit unresponsive
      // and clear so the next interval issues a fresh ping.
      if (entry.outstandingSeq !== null && entry.outstandingSentAt !== null && now - entry.outstandingSentAt > config.timeoutMs) {
        config.emit(id, {
          source: 'heartbeat',
          verdict: 'unresponsive',
          reason: { kind: 'heartbeat-timeout' },
        });
        entry.outstandingSeq = null;
        entry.outstandingSentAt = null;
      }
      if (!entry.visible) continue;
      entry.seq += 1;
      entry.outstandingSeq = entry.seq;
      entry.outstandingSentAt = now;
      try {
        entry.webContents.send(HEARTBEAT_CHANNEL, entry.seq);
      } catch {
        // If send throws, treat the entry as gone; reaper will catch it next tick.
      }
    }
  }

  const timer = setInterval(tick, config.intervalMs);

  return {
    attach(input) {
      entries.set(input.webContentsId, {
        webContents: input.webContents,
        productId: input.productId,
        visible: input.visible,
        seq: 0,
        outstandingSeq: null,
        outstandingSentAt: null,
      });
    },
    detach(id) {
      entries.delete(id);
    },
    setVisible(id, visible) {
      const e = entries.get(id);
      if (!e) return;
      e.visible = visible;
      if (!visible) {
        // Drop any outstanding ping so we don't reap it as a timeout after resume.
        e.outstandingSeq = null;
        e.outstandingSentAt = null;
      }
    },
    handlePong(id, seq) {
      const entry = entries.get(id);
      if (!entry) return;
      if (entry.outstandingSeq !== seq) return; // stale or unknown
      const sentAt = entry.outstandingSentAt;
      entry.outstandingSeq = null;
      entry.outstandingSentAt = null;
      if (sentAt === null) return;
      const rttMs = config.now() - sentAt;
      if (rttMs > config.rttDegradedMs) {
        config.emit(id, {
          source: 'heartbeat',
          verdict: 'degrade',
          reason: { kind: 'heartbeat-rtt-high' },
        });
      } else {
        config.emit(id, {
          source: 'heartbeat',
          verdict: 'good',
          reason: { kind: 'recovered' },
        });
      }
    },
    stop() {
      clearInterval(timer);
      entries.clear();
    },
  };
}
