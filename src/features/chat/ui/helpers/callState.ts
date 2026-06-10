import { type ChatMessage } from '@/domains/chat';

// Mirrors iOS `Chat.CallState` (polkadot-app-ios-v2 ChatCallState.swift). A call
// produces one offer plus 0+ answer / ice / closed signals — the renderer needs
// a single derived state per offer.
export type CallState =
  | { kind: 'calling' }
  | { kind: 'active' }
  | { kind: 'finished'; durationMs: number }
  | { kind: 'cancelled'; ringDurationMs: number }
  | { kind: 'missed' };

export function deriveCallStates(messages: ChatMessage[]): Map<string, CallState> {
  type Bucket = {
    offer: ChatMessage;
    earliestAnswer?: ChatMessage;
    earliestClosed?: ChatMessage;
  };

  const buckets = new Map<string, Bucket>();

  // First pass — register offers.
  for (const msg of messages) {
    if (msg.content.type === 'callSignal' && msg.content.signal === 'offer') {
      buckets.set(msg.messageId, { offer: msg });
    }
  }

  // Second pass — fold answer / closed into their offer bucket.
  for (const msg of messages) {
    if (msg.content.type !== 'callSignal') continue;
    if (msg.content.signal === 'offer') continue;
    const offerId = msg.content.offerMessageId;
    if (!offerId) continue;
    const bucket = buckets.get(offerId);
    if (!bucket) continue;

    if (msg.content.signal === 'answer') {
      if (!bucket.earliestAnswer || msg.timestamp < bucket.earliestAnswer.timestamp) {
        bucket.earliestAnswer = msg;
      }
    } else if (msg.content.signal === 'closed') {
      if (!bucket.earliestClosed || msg.timestamp < bucket.earliestClosed.timestamp) {
        bucket.earliestClosed = msg;
      }
    }
    // ice is intentionally ignored — it carries no state-derivation signal.
  }

  const out = new Map<string, CallState>();
  for (const [offerId, { offer, earliestAnswer, earliestClosed }] of buckets) {
    if (!earliestClosed) {
      out.set(offerId, earliestAnswer ? { kind: 'active' } : { kind: 'calling' });
      continue;
    }

    if (earliestAnswer) {
      out.set(offerId, { kind: 'finished', durationMs: saturatingSubtract(earliestClosed.timestamp, earliestAnswer.timestamp) });
      continue;
    }

    if (offer.status.direction === 'outgoing') {
      out.set(offerId, { kind: 'cancelled', ringDurationMs: saturatingSubtract(earliestClosed.timestamp, offer.timestamp) });
    } else {
      out.set(offerId, { kind: 'missed' });
    }
  }

  return out;
}

function saturatingSubtract(a: number, b: number): number {
  return a >= b ? a - b : 0;
}

// `M:SS` for sub-hour calls; `H:MM:SS` past an hour. Matches Figma copy.
export function formatCallDuration(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  if (hours > 0) return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  return `${minutes}:${pad(seconds)}`;
}
