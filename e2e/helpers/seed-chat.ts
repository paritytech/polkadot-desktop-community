import { type Page, expect } from '@playwright/test';

import { TEST_IDS } from '@/shared/test-ids';

import { DEFAULT_TIMEOUT, VERY_LONG_TIMEOUT } from './timeouts';

/**
 * Pre-render chat-session seeding for the e2e suite.
 *
 * The live P2P attestation/handshake backend is required to establish a real
 * chat room (peer search → request → accept), so every UI-over-existing-data
 * chat case (message grouping, the message context menu, edit/reply compose,
 * delete-conversation, room-list sorting) was unautomatable whenever that
 * backend is unavailable. These helpers write a chat SESSION + its MESSAGES
 * directly into the chat domain's standalone Dexie database (`p2p-chat`), so
 * the renderer renders a fully-populated room with NO live handshake.
 *
 * Persistence facts (verified against `src/domains/chat/p2p`):
 *  - The chat domain keeps its OWN Dexie DB, `new Dexie('p2p-chat')` (NOT the
 *    unified `polkadot-desktop-app-v1` that `seed-products.ts` targets).
 *  - `rooms` keyPath = `sessionId`; the rooms stream resource queries
 *    `rooms.where('userId').equals(userId)`, so a seeded room is only visible
 *    under the SIGNED-IN user's id.
 *  - `messages` keyPath = `messageId`; the messages stream resource queries
 *    `messages.where('sessionId').equals(sessionId)`, and a room's `sessionId`
 *    IS its `peerId`. So a message belongs to a room when its `sessionId`
 *    equals that room's `peerId`.
 *  - The chat LIST (`useP2PSessions`) only renders rooms once the P2P chat
 *    MANAGER is live (`p2pChatManager$ !== null`). The manager initialises
 *    post-sign-in from the local SSO V2 identity and tolerates the backend
 *    being down (its subscriptions are fire-and-forget, `startSession` is
 *    catch-wrapped), so it comes up regardless. It also exposes the exact
 *    user id the rooms are keyed by on `window.__p2pV2Debug.userId` — that is
 *    how we discover the seed's `userId` at runtime (it is per-test, derived
 *    from the bot identity).
 *
 * IMPORTANT — seed only AFTER the manager is up. The `p2p-chat` Dexie DB +
 * object stores are created lazily when the manager first reads them, and the
 * seed `userId` is read from `window.__p2pV2Debug`. `waitForChatManager` blocks
 * on both. After writing, a `page.reload()` is mandatory (the rooms/messages
 * stream resources read through Dexie `liveQuery`, which does NOT observe our
 * raw IndexedDB writes — exactly the `seed-products.ts` gotcha), and we then
 * navigate home so the next `openFullscreen()` starts from the dashboard.
 *
 * All state lands in the per-test fresh `userDataDir`, so the suite's existing
 * `clearAppData()` cleans it up — nothing leaks between tests.
 */

declare global {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions -- augmenting the lib `Window` interface requires `interface`, not `type`
  interface Window {
    /** Debug surface published by the P2P chat manager (see managerV2Factory). */
    __p2pV2Debug?: { userId?: string };
  }
}

const CHAT_DB_NAME = 'p2p-chat';

export type SeedChatMessageSpec = {
  /** Plain message text. */
  text: string;
  /** Who sent it. `outgoing` = the signed-in user, `incoming` = the peer. */
  direction: 'incoming' | 'outgoing';
  /**
   * Whole days to subtract from "now" for this message's timestamp. `0`
   * (default) = today. Used to drive date separators / message grouping.
   */
  ageDays?: number;
  /**
   * Extra milliseconds added on top of the day bucket so messages within one
   * day keep a deterministic order (later `offsetMs` sorts later).
   */
  offsetMs?: number;
};

export type SeedChatRoomSpec = {
  /**
   * Stable peer identifier — used as both the room `sessionId` and `peerId`,
   * and as each message's `sessionId`. Any unique string works (it is never
   * decoded as an SS58 on the render path; manager `startSession` for it is
   * catch-wrapped), but use a realistic-looking value.
   */
  peerId: string;
  /** Display name shown in the chat list + room header. Must be non-empty. */
  peerUsername: string;
  /** Messages for this room. An empty array seeds a room with no messages. */
  messages: SeedChatMessageSpec[];
};

type ChatMessageRow = {
  messageId: string;
  sessionId: string;
  peer: { type: 'p2p'; accountId: string; name: string };
  timestamp: number;
  content: { type: 'text'; text: string };
  status: { direction: 'incoming'; state: 'seen' } | { direction: 'outgoing'; state: 'delivered' };
  lastUpdate: number;
};

type ChatRoomRow = {
  sessionId: string;
  peerId: string;
  peerUsername: string;
  userId: string;
  createdAt: number;
  lastUpdate: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function buildRoomRows(specs: SeedChatRoomSpec[], userId: string, now: number): ChatRoomRow[] {
  return specs.map((spec, roomIndex) => ({
    sessionId: spec.peerId,
    peerId: spec.peerId,
    peerUsername: spec.peerUsername,
    userId,
    createdAt: now - roomIndex,
    lastUpdate: now - roomIndex,
  }));
}

function buildMessageRows(specs: SeedChatRoomSpec[], userId: string, now: number): ChatMessageRow[] {
  const rows: ChatMessageRow[] = [];
  for (const room of specs) {
    let msgIndex = 0;
    for (const msg of room.messages) {
      const timestamp = now - (msg.ageDays ?? 0) * DAY_MS + (msg.offsetMs ?? msgIndex);
      const isOutgoing = msg.direction === 'outgoing';
      rows.push({
        messageId: `seed-${room.peerId}-${msgIndex}`,
        sessionId: room.peerId,
        peer: isOutgoing
          ? { type: 'p2p', accountId: userId, name: '' }
          : { type: 'p2p', accountId: room.peerId, name: room.peerUsername },
        timestamp,
        content: { type: 'text', text: msg.text },
        status: isOutgoing ? { direction: 'outgoing', state: 'delivered' } : { direction: 'incoming', state: 'seen' },
        lastUpdate: timestamp,
      });
      msgIndex += 1;
    }
  }
  return rows;
}

/**
 * Wait until the P2P chat manager is live and return the user id the chat
 * rooms are keyed by. Resolves once `window.__p2pV2Debug.userId` is populated
 * (the manager publishes it during `createP2PChatManagerV2`).
 */
export async function waitForChatManager(page: Page): Promise<string> {
  await expect
    .poll(() => page.evaluate(() => window.__p2pV2Debug?.userId ?? null), { timeout: VERY_LONG_TIMEOUT })
    .not.toBeNull();

  const userId = await page.evaluate(() => window.__p2pV2Debug?.userId ?? null);
  if (!userId) throw new Error('[seed-chat] chat manager userId unavailable after wait');
  return userId;
}

async function idbPutChat(page: Page, rooms: ChatRoomRow[], messages: ChatMessageRow[]): Promise<void> {
  await page.evaluate(
    async ({ dbName, roomRows, messageRows }) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(dbName);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      try {
        for (const store of ['rooms', 'messages']) {
          if (!db.objectStoreNames.contains(store)) {
            throw new Error(`Object store "${store}" not found in "${dbName}" — seed after the chat manager has booted.`);
          }
        }
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction(['rooms', 'messages'], 'readwrite');
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
          tx.onabort = () => reject(tx.error);
          const roomStore = tx.objectStore('rooms');
          for (const row of roomRows) roomStore.put(row);
          const messageStore = tx.objectStore('messages');
          for (const row of messageRows) messageStore.put(row);
        });
      } finally {
        db.close();
      }
    },
    { dbName: CHAT_DB_NAME, roomRows: rooms, messageRows: messages },
  );
}

/**
 * Seed one or more chat rooms (with messages) for the signed-in user, then
 * reload and return to the dashboard so the renderer picks them up on a fresh
 * subscription. Must run on a signed-in session.
 */
export async function seedChatRooms(page: Page, specs: SeedChatRoomSpec[]): Promise<void> {
  const userId = await waitForChatManager(page);
  const now = Date.now();
  await idbPutChat(page, buildRoomRows(specs, userId, now), buildMessageRows(specs, userId, now));

  await page.reload();
  await page.waitForLoadState('domcontentloaded');

  const homeButton = page.getByTestId(TEST_IDS.homeButton);
  await expect(homeButton).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  await homeButton.click();
  await page.waitForURL(/dashboard/, { timeout: DEFAULT_TIMEOUT });

  // Re-await the manager so the seeded rooms have a live manager to map through
  // (the chat list returns [] until `p2pChatManager$` is repopulated post-reload).
  await waitForChatManager(page);
}
