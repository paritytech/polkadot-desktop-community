import { type Page, expect } from '@playwright/test';

import { TEST_IDS } from '@/shared/test-ids';

import { DEFAULT_TIMEOUT } from './timeouts';

/**
 * Wipe the Desktop-side P2P chat state and land on the dashboard so the next
 * scenario starts from a known, clean view.
 *
 * Clears every object store in the Dexie `p2p-chat` database (rooms, messages,
 * requests, outbox) via IndexedDB directly, reloads, then clicks the home
 * button. Reload is required so live queries and the ChatManager reinitialise
 * on the empty DB; home navigation is required because reload preserves the
 * current URL (may be a chat tab from a previous scenario).
 */
export async function resetDesktopChatState(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await new Promise<void>(resolve => {
      const req = indexedDB.open('p2p-chat');
      req.onerror = () => resolve();
      req.onsuccess = () => {
        const db = req.result;
        const storeNames = Array.from(db.objectStoreNames);
        if (storeNames.length === 0) {
          db.close();
          resolve();
          return;
        }
        const tx = db.transaction(storeNames, 'readwrite');
        for (const name of storeNames) {
          tx.objectStore(name).clear();
        }
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => {
          db.close();
          resolve();
        };
      };
    });
  });

  await page.reload();
  await page.waitForLoadState('domcontentloaded');

  const homeButton = page.getByTestId(TEST_IDS.homeButton);
  await expect(homeButton).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  await homeButton
    .locator('button')
    .click()
    .catch(async () => {
      // Some HeaderButton wrappers render the button at the same level; try direct click.
      await homeButton.click();
    });
  await page.waitForURL(/dashboard/, { timeout: DEFAULT_TIMEOUT });
}
