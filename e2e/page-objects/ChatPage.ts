import { type Page, expect } from '@playwright/test';

import { TEST_IDS } from '@/shared/test-ids';
import { DEFAULT_TIMEOUT, LONG_TIMEOUT } from '../helpers/timeouts';

export class ChatPage {
  constructor(private readonly page: Page) {}

  /**
   * Toolbar HeaderButton wrapper that opens the QuickChat popover.
   */
  get quickChatTrigger() {
    return this.page.getByTestId(TEST_IDS.quickChatButton);
  }

  /**
   * QuickChat popover content. Anchored to a stable testid so the locator
   * doesn't depend on which sub-view is active inside the popover (chat list
   * vs an open conversation) or on translatable button text.
   */
  get quickChatPopover() {
    return this.page.getByTestId(TEST_IDS.quickChatPopover);
  }

  get roomList() {
    return this.page.getByTestId(TEST_IDS.chatRoomList);
  }

  /**
   * Active chat sessions (rooms), excluding outgoing-request placeholders.
   * Use this to assert that an auto-accepted session exists, not just a
   * pending outgoing request with the same peer name.
   */
  get roomItems() {
    return this.page.getByTestId(TEST_IDS.chatRoomItem);
  }

  roomItemByName(name: string) {
    return this.roomItems.filter({ hasText: name });
  }

  get messageInput() {
    return this.page.getByTestId(TEST_IDS.chatMessageInput);
  }

  get sendButton() {
    return this.page.getByTestId(TEST_IDS.chatSendButton);
  }

  /**
   * Open the QuickChat popover by clicking the toolbar button. Idempotent:
   * if the popover is already open, returns immediately.
   */
  async openQuickChat() {
    if (await this.quickChatPopover.isVisible().catch(() => false)) return;
    await this.dismissPendingAliasDialog();
    await expect(this.quickChatTrigger).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    await this.quickChatTrigger.click();
    await expect(this.quickChatPopover).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  }

  private get aliasAllowButton() {
    return this.page.getByTestId(TEST_IDS.aliasPermissionAllow);
  }

  /**
   * Proactively dismiss a pending Product alias-request AlertDialog if one is
   * already on screen. The shared `addLocatorHandler` in `helpers/dialogs.ts`
   * is reactive (fires only when an action is *blocked* by the locator), so it
   * misses the case where the modal appears *after* the QuickChat popover has
   * opened — Radix's modal then steals focus and closes the popover, leaving
   * subsequent waits hanging.
   */
  private async dismissPendingAliasDialog() {
    if (await this.aliasAllowButton.isVisible().catch(() => false)) {
      await this.aliasAllowButton.click();
      await expect(this.aliasAllowButton).toBeHidden({ timeout: DEFAULT_TIMEOUT });
    }
  }

  /**
   * Wait for a named chat session to appear in the QuickChat popover.
   * Opens the popover automatically — the dashboard no longer hosts a
   * persistent chat widget, so `the chat session appears in the chat widget`
   * step now means "appears in the quick-chat popover".
   */
  async waitForSessionInWidget(name: string) {
    const openAndFind = async () => {
      await this.openQuickChat();
      const item = this.quickChatPopover.getByTestId(TEST_IDS.chatRoomItem).filter({ hasText: name });
      await expect(item.first()).toBeVisible({ timeout: LONG_TIMEOUT });
    };
    try {
      await openAndFind();
    } catch {
      // Alias-permission handler may have fired during the wait, closing the
      // quick chat popover. Re-open and retry once.
      await openAndFind();
    }
  }

  /**
   * Navigate to the fullscreen `/chat` route via the QuickChat popover's
   * expand button. Always opens the popover first — the dashboard chat
   * widget is no longer part of the default layout, so there's no fallback
   * surface to reach the fullscreen view from.
   *
   * Retries once: a product alias-permission AlertDialog can pop up while the
   * popover is open (Radix modal steals focus → closes the popover), so the
   * expand button vanishes mid-flight. The catch path re-opens the popover
   * — by then the dialog is dismissed, alias is granted — and tries again.
   */
  async openFullscreen() {
    const openAndNavigate = async () => {
      await this.openQuickChat();
      const expandButton = this.page.getByTestId(TEST_IDS.quickChatExpandButton);
      await expect(expandButton).toBeVisible({ timeout: DEFAULT_TIMEOUT });
      await expandButton.click();
      await expect(this.roomList).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    };
    try {
      await openAndNavigate();
    } catch {
      await openAndNavigate();
    }
  }

  async selectSession(name: string) {
    const item = this.roomItemByName(name);
    await expect(item).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    await item.click();
  }

  /**
   * Select a named chat session inside the QuickChat popover.
   * Ensures the popover is open (reopens if a modal closed it), scopes the
   * lookup to the popover, then clicks the session row — switching the popover
   * from list view to conversation view.
   *
   * Retries once on failure: same alias-dialog race as waitForSessionInWidget /
   * openFullscreen — modal closes popover mid-flight, catch re-opens it.
   */
  async selectSessionInWidget(name: string) {
    const openAndSelect = async () => {
      await this.openQuickChat();
      const item = this.quickChatPopover.getByTestId(TEST_IDS.chatRoomItem).filter({ hasText: name });
      await expect(item.first()).toBeVisible({ timeout: DEFAULT_TIMEOUT });
      await item.first().click();
    };
    try {
      await openAndSelect();
    } catch {
      await openAndSelect();
    }
  }

  /**
   * Click the first available chat session in the sidebar.
   * Use when the peer's displayed name is empty or unreliable — e.g. the P2P
   * chat request doesn't carry the requester's own username, so on the
   * accepting side the ChatItem renders with an empty name string.
   */
  async selectFirstSession() {
    const first = this.roomItems.first();
    await expect(first).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    await first.click();
  }

  async sendMessage(message: string) {
    const doSend = async () => {
      await expect(this.messageInput).toBeVisible({ timeout: DEFAULT_TIMEOUT });
      await this.messageInput.click();
      await this.messageInput.fill(message);
      await expect(this.sendButton).toBeEnabled({ timeout: DEFAULT_TIMEOUT });
      await this.sendButton.click();
    };

    try {
      await doSend();
    } catch {
      // Alias-permission modal may have closed the QuickChat popover mid-flight
      // (Radix modal steals focus). Re-open the popover — alias is now granted,
      // no further dialog. If the popover landed on the room list instead of an
      // active conversation, click the first session to enter it, then retry.
      await this.openQuickChat();
      const isInConversation = await this.messageInput.isVisible().catch(() => false);
      if (!isInConversation) {
        const firstRoom = this.quickChatPopover.getByTestId(TEST_IDS.chatRoomItem).first();
        await expect(firstRoom).toBeVisible({ timeout: LONG_TIMEOUT });
        await firstRoom.click();
      }
      await doSend();
    }
  }

  messageByText(text: string) {
    return this.page.getByText(text, { exact: true }).last();
  }

  /**
   * Open the message context menu by right-clicking the first match for the given text
   * and pick an emoji from the QuickReactionRow.
   */
  async reactToMessage(messageText: string, emoji: string) {
    const bubble = this.messageByText(messageText);
    await expect(bubble).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    await bubble.click({ button: 'right' });

    const quickRow = this.page.getByTestId(TEST_IDS.chatQuickReactionsRow);
    await expect(quickRow).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    const emojiButton = quickRow.getByText(emoji, { exact: true });
    await expect(emojiButton).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    await emojiButton.click();
  }

  reactionPillByEmoji(emoji: string) {
    return this.page.getByTestId(TEST_IDS.chatReactionPill).filter({ hasText: emoji });
  }
}
