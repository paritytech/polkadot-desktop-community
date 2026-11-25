import { type Page, expect } from '@playwright/test';

import { TEST_IDS } from '@/shared/test-ids';
import { DEFAULT_TIMEOUT, LONG_TIMEOUT, VERY_LONG_TIMEOUT } from '../helpers/timeouts';

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

  /**
   * The "Add to Dashboard" button rendered in the address bar on the `/chat`
   * route (chat's leading affordance in place of the product ••• menu).
   */
  get addToDashboardButton() {
    return this.page.getByTestId(TEST_IDS.chatAddToDashboardButton);
  }

  /**
   * Open the native "Add to Dashboard" modal from the chat address bar.
   * Requires the fullscreen `/chat` route to be active (see openFullscreen).
   */
  async openAddToDashboard() {
    await expect(this.addToDashboardButton).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    await this.addToDashboardButton.click();
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

  // ── Seeded-session message display + actions ──────────────────────────────

  get dateSeparators() {
    return this.page.getByTestId(TEST_IDS.chatDateSeparator);
  }

  get noMessagesPlaceholder() {
    return this.page.getByTestId(TEST_IDS.chatNoMessagesPlaceholder);
  }

  get contextMenu() {
    return this.page.getByTestId(TEST_IDS.chatMessageContextMenu);
  }

  get emojiPicker() {
    return this.page.getByTestId(TEST_IDS.chatEmojiPicker);
  }

  /** A message bubble carrying the given text, optionally filtered by direction. */
  messageBubble(text: string, direction?: 'incoming' | 'outgoing') {
    let bubbles = this.page.getByTestId(TEST_IDS.chatMessageBubble).filter({ hasText: text });
    if (direction) bubbles = bubbles.and(this.page.locator(`[data-direction="${direction}"]`));
    return bubbles.first();
  }

  /** Open the right-click context menu on a message bubble. */
  async openContextMenu(text: string, direction?: 'incoming' | 'outgoing') {
    // Close any menu left open by a prior assertion so the new right-click lands cleanly.
    if (await this.contextMenu.isVisible().catch(() => false)) {
      await this.page.keyboard.press('Escape');
      await expect(this.contextMenu).toBeHidden({ timeout: DEFAULT_TIMEOUT });
    }
    const bubble = this.messageBubble(text, direction);
    await expect(bubble).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    await bubble.click({ button: 'right' });
    await expect(this.contextMenu).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  }

  editMenuItemVisible() {
    return this.editMenuItem().isVisible();
  }

  /** Open the full emoji picker from a message's quick-reaction row. */
  async openEmojiPicker(text: string) {
    await this.openContextMenu(text);
    const openButton = this.page.getByTestId(TEST_IDS.chatEmojiPickerOpenButton);
    await expect(openButton).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    await openButton.click();
    await expect(this.emojiPicker).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  }

  /** Trigger Reply on a message and return the reply-compose preview locator. */
  async replyToMessage(text: string) {
    await this.openContextMenu(text);
    await this.page.getByTestId(TEST_IDS.chatMessageContextMenuReply).click();
  }

  get replyComposer() {
    return this.page.getByTestId(TEST_IDS.chatReplyComposer);
  }

  /** Trigger Edit on an own message and return the edit-compose preview locator. */
  async editMessage(text: string) {
    await this.openContextMenu(text, 'outgoing');
    await this.page.getByTestId(TEST_IDS.chatMessageContextMenuEdit).click();
  }

  get editComposer() {
    return this.page.getByTestId(TEST_IDS.chatEditComposer);
  }

  editMenuItem() {
    return this.page.getByTestId(TEST_IDS.chatMessageContextMenuEdit);
  }

  async copyMessageText(text: string) {
    await this.openContextMenu(text);
    await this.page.getByTestId(TEST_IDS.chatMessageContextMenuCopy).click();
  }

  /** Delete the open conversation from the room header ••• menu. */
  async deleteConversation() {
    const trigger = this.page.getByTestId(TEST_IDS.chatRoomHeaderMenuTrigger);
    await expect(trigger).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    await trigger.click();
    const deleteItem = this.page.getByTestId(TEST_IDS.chatRoomHeaderMenuDelete);
    await expect(deleteItem).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    await deleteItem.click();
  }

  /** Names of the rooms in list order (top → bottom). */
  async roomNamesInOrder(): Promise<string[]> {
    await expect(this.roomItems.first()).toBeVisible({ timeout: LONG_TIMEOUT });
    return this.roomItems.allInnerTexts();
  }

  // ── Composer: send-gating + Enter/Shift+Enter (TC-7.2.4 / 7.2.5) ───────────

  /**
   * Type into the composer. `pressSequentially` focuses the textarea via
   * `focus()` (which preserves the caret), so repeated calls append at the end
   * — exactly what the Shift+Enter newline sequence needs.
   */
  async typeInComposer(text: string) {
    await expect(this.messageInput).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    await this.messageInput.pressSequentially(text);
  }

  /** Replace the composer contents (fill moves the caret to the end). */
  async fillComposer(text: string) {
    await expect(this.messageInput).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    await this.messageInput.fill(text);
  }

  async clearComposer() {
    await this.fillComposer('');
  }

  /** Press a key combination on the focused composer (e.g. `Shift+Enter`, `Enter`). */
  async pressInComposer(key: string) {
    await this.messageInput.press(key);
  }

  composerValue(): Promise<string> {
    return this.messageInput.inputValue();
  }

  // ── Dashboard chat widget (TC-7.6.3) ───────────────────────────────────────

  /** The dashboard chat-widget card body that lists chat sessions. */
  get chatWidgetCard() {
    return this.page.getByTestId(TEST_IDS.chatWidget);
  }

  /** A session row inside the dashboard chat widget, matched by display name. */
  chatWidgetRoomByName(name: string) {
    return this.chatWidgetCard.getByTestId(TEST_IDS.chatRoomItem).filter({ hasText: name });
  }

  /**
   * Open the chat widget fullscreen via its card-topbar Maximize action. The
   * button is `opacity-0` until hover but stays hit-testable, so the click is
   * forced (same approach as the product `WidgetCardPage`).
   */
  async openWidgetFullscreen() {
    const button = this.page.getByTestId(TEST_IDS.chatWidgetFullscreenButton);
    await expect(button).toBeAttached({ timeout: LONG_TIMEOUT });
    await button.click({ force: true, timeout: DEFAULT_TIMEOUT });
  }

  // ── Requests: incoming (Bob) + outgoing (Alice) — live-pair request stage ──

  /** The "New Requests" sidebar entry shown when ≥1 incoming request is pending. */
  get newRequestsItem() {
    return this.page.getByTestId(TEST_IDS.chatNewRequestsItem);
  }

  /** The unread-count badge on the "New Requests" sidebar entry. */
  get newRequestsCount() {
    return this.page.getByTestId(TEST_IDS.chatNewRequestsCount);
  }

  /** Accept buttons inside the open requests list (one per incoming request). */
  get requestAcceptButtons() {
    return this.page.getByTestId(TEST_IDS.chatRequestAcceptButton);
  }

  /** Decline buttons inside the open requests list (one per incoming request). */
  get requestDeclineButtons() {
    return this.page.getByTestId(TEST_IDS.chatRequestDeclineButton);
  }

  /** Outgoing-request placeholder rows in the sender's own sidebar. */
  get outgoingRequestItems() {
    return this.page.getByTestId(TEST_IDS.chatOutgoingRequestItem);
  }

  /** The pending "waiting for them to accept" room shown for a selected outgoing request. */
  get outgoingPendingRoom() {
    return this.page.getByTestId(TEST_IDS.chatOutgoingPendingRoom);
  }

  /**
   * Wait for an incoming request to land (on-chain propagation is slow, so a
   * very long timeout) and open the "New Requests" list.
   */
  async openNewRequests() {
    await expect(this.newRequestsItem).toBeVisible({ timeout: VERY_LONG_TIMEOUT });
    await this.newRequestsItem.click();
  }

  /** Wait for the incoming request to land and assert the New Requests counter. */
  async expectNewRequestsCount(count: number) {
    await expect(this.newRequestsItem).toBeVisible({ timeout: VERY_LONG_TIMEOUT });
    await expect(this.newRequestsCount).toHaveText(String(count), { timeout: DEFAULT_TIMEOUT });
  }

  /** Click Decline on the first incoming request, opening the confirmation dialog. */
  async declineFirstRequest() {
    const decline = this.requestDeclineButtons.first();
    await expect(decline).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    // testid is on a wrapper div (Button doesn't forward it here), so target the inner button.
    await decline.locator('button').click();
  }

  /** Confirm the decline in the confirmation dialog and wait for it to close. */
  async confirmDecline() {
    const confirm = this.page.getByTestId(TEST_IDS.chatDeclineDialogConfirm);
    await expect(confirm).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    await confirm.click();
    await expect(this.page.getByTestId(TEST_IDS.chatDeclineDialog)).toBeHidden({ timeout: DEFAULT_TIMEOUT });
  }

  /** Select the first outgoing-request placeholder, opening its pending room. */
  async openFirstOutgoingRequest() {
    const item = this.outgoingRequestItems.first();
    await expect(item).toBeVisible({ timeout: VERY_LONG_TIMEOUT });
    await item.click();
  }

  /** Remove/cancel the open outgoing request via the pending room's ••• menu. */
  async removeOutgoingRequest() {
    const trigger = this.page.getByTestId(TEST_IDS.chatOutgoingPendingRoomMenuTrigger);
    await expect(trigger).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    await trigger.click();
    const remove = this.page.getByTestId(TEST_IDS.chatOutgoingPendingRoomRemove);
    await expect(remove).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    await remove.click();
    const confirm = this.page.getByTestId(TEST_IDS.chatCancelRequestDialogConfirm);
    await expect(confirm).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    await confirm.click();
  }
}
