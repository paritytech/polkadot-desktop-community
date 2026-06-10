import * as v from 'valibot';

import { createDexieDatabase } from '@/shared/dexie';
import { removeLocalStorageKeysByPrefix } from '@/shared/utils';
import { type ChatMessage } from '../session/types';

import { type OutboxRecord, OutboxRecordSchema } from './schemas';
import { type OutboxPort } from './types';
import { type P2PChatRequest, type P2POutboxEntry, type P2PRoom } from './types';

// HOP `hop_claim` evicts the entry server-side on success, so a single
// download empties the pool for that identifier. Without local persistence
// every chat reopen would 404 against the bulletin server. We keep the
// decrypted bytes in IndexedDB keyed by hex(identifier).
export type DownloadedFileBlob = {
  identifierHex: string;
  mimeType: string;
  bytes: Uint8Array;
  downloadedAt: number;
};

export const p2pChatDatabase = createDexieDatabase<{
  rooms: P2PRoom;
  messages: ChatMessage;
  requests: P2PChatRequest;
  // Dormant V1 table — no writers since the V2 session manager landed. The
  // V2 outbox is the localStorage record below (`loadOutboxRecord` & co),
  // NOT this table. Dropping it needs a schema version bump — separate cleanup.
  outbox: P2POutboxEntry;
  downloadedFiles: DownloadedFileBlob;
}>({
  name: 'p2p-chat',
  version: 3,
  schema: {
    rooms: 'sessionId, peerId, userId, lastUpdate',
    messages: 'messageId, sessionId, lastUpdate',
    requests: 'requestId, peerId, userId, lastUpdate',
    outbox: 'id, peerId',
    downloadedFiles: 'identifierHex, downloadedAt',
  },
});

/**
 * Wipe every P2P chat row. Called on logout so one user's chat history
 * doesn't bleed into the next user paired on this device, and so it isn't
 * readable from DevTools / file-system after the user has signed out.
 *
 * `onPairingSuccess` already clears contacts + device-sync on a new
 * handshake, but that only runs if the user re-pairs — a plain logout
 * leaves these rows in place. The matching multi-device cleanup lives in
 * `papp-provider/hooks.ts::onV2Disconnect`.
 */
export const clearAllP2PChatStorage = async (): Promise<void> => {
  clearAllOutboxRecords();
  await Promise.all([
    p2pChatDatabase.rooms.clear(),
    p2pChatDatabase.messages.clear(),
    p2pChatDatabase.requests.clear(),
    p2pChatDatabase.outbox.clear(),
    p2pChatDatabase.downloadedFiles.clear(),
  ]);
};

// ── V2 outbox (localStorage) ────────────────────────────────────────────
// One JSON record per (user, peer): the session's unacked batch + request
// coverage + parked FIFO queue. See `OutboxRecordSchema` for the shape and
// why it's persisted. localStorage (not Dexie): record sizes are text-scale,
// writes are synchronous on every batch/queue mutation, and the agreed
// design (Sergey, 06.06) explicitly allows it.

const OUTBOX_KEY_PREFIX = 'p2p-chat-outbox:v1';

function outboxKey(userId: string, peerId: string): string {
  return `${OUTBOX_KEY_PREFIX}:${userId}:${peerId}`;
}

export function loadOutboxRecord(userId: string, peerId: string): OutboxRecord | null {
  const key = outboxKey(userId, peerId);
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    const parsed = v.safeParse(OutboxRecordSchema, JSON.parse(raw));
    if (!parsed.success) throw new Error(v.summarize(parsed.issues));
    return parsed.output;
  } catch (e) {
    console.warn(
      '[p2p-chat] corrupt outbox record user=%s peer=%s — starting clean: %s',
      userId,
      peerId,
      e instanceof Error ? e.message : String(e),
    );
    try {
      localStorage.removeItem(key);
    } catch {
      // storage unavailable — nothing to clean
    }
    return null;
  }
}

export function saveOutboxRecord(userId: string, peerId: string, record: OutboxRecord): void {
  try {
    localStorage.setItem(outboxKey(userId, peerId), JSON.stringify(record));
  } catch (e) {
    // QuotaExceeded / storage-disabled must not break the send path mid-op
    // (callers persist after irreversible effects like a successful submit).
    // The in-memory session stays authoritative for this run; worst case a
    // restart loses the un-persisted delta. Quota pressure is realistic: the
    // origin's localStorage is shared with product-driven writes.
    console.warn(
      '[p2p-chat] failed to persist outbox record user=%s peer=%s: %s',
      userId,
      peerId,
      e instanceof Error ? e.message : String(e),
    );
  }
}

export function clearOutboxRecord(userId: string, peerId: string): void {
  try {
    localStorage.removeItem(outboxKey(userId, peerId));
  } catch {
    // storage unavailable — nothing to clear
  }
}

export function clearAllOutboxRecords(): void {
  removeLocalStorageKeysByPrefix(OUTBOX_KEY_PREFIX);
}

/**
 * The session-facing port over the record helpers, closed over its (user,
 * peer) key. The key shape stays a repository concern — consumers hold a
 * port, not the tuple.
 */
export function createOutboxStorage(userId: string, peerId: string): OutboxPort {
  return {
    load: () => loadOutboxRecord(userId, peerId),
    save: record => saveOutboxRecord(userId, peerId, record),
    clear: () => clearOutboxRecord(userId, peerId),
  };
}
