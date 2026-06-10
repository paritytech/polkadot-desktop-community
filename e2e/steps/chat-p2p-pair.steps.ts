import { type Page } from '@playwright/test';
import { createBdd } from 'playwright-bdd';

import { TEST_IDS } from '@/shared/test-ids';
import { chatPairTest, expect } from '../fixtures/chatPair';
import { resetDesktopChatState } from '../helpers/chatState';
import { DEFAULT_TIMEOUT, LONG_TIMEOUT, VERY_LONG_TIMEOUT } from '../helpers/timeouts';
import { ChatPage } from '../page-objects/ChatPage';
import { ContactSearchPage } from '../page-objects/ContactSearchPage';

const { Given, When, Then } = createBdd(chatPairTest);

function searchPage(page: Page) {
  return new ContactSearchPage(page);
}

function chatPage(page: Page) {
  return new ChatPage(page);
}

// ─── Background ───────────────────────────────────────────────────────────

Given(
  'Alice and Bob are both authenticated',
  // eslint-disable-next-line @typescript-eslint/require-await -- assertions only; Given must return Promise
  async ({ alice, bob }) => {
    expect(alice.botUsername).toBeTruthy();
    expect(bob.botUsername).toBeTruthy();
  },
);

Given('no chat session exists between Alice and Bob', async ({ alice, bob }) => {
  await Promise.all([resetDesktopChatState(alice.app.window), resetDesktopChatState(bob.app.window)]);
});

// ─── Alice actions ─────────────────────────────────────────────────────────

When('Alice opens the chat as a tab', async ({ alice }) => {
  await chatPage(alice.app.window).openFullscreen();
});

When('Alice opens the contact search', async ({ alice }) => {
  await searchPage(alice.app.window).openFromFullscreen();
});

When("Alice types Bob's username into the contact search", async ({ alice, bob }) => {
  await searchPage(alice.app.window).typeQuery(bob.botUsername);
});

When('Alice selects Bob from the search results', async ({ alice, bob }) => {
  const search = searchPage(alice.app.window);
  // On-chain username attestation may take longer than DEFAULT_TIMEOUT to
  // propagate to the indexer right after sign-in, so wait extra long here.
  await expect(search.resultByName(bob.botUsername)).toBeVisible({ timeout: VERY_LONG_TIMEOUT });
  await search.selectResult(bob.botUsername);
});

When('Alice types {string} into the welcome message field', async ({ alice }, text: string) => {
  await searchPage(alice.app.window).fillWelcome(text);
});

When('Alice clicks "Send Request"', async ({ alice }) => {
  await searchPage(alice.app.window).submitRequest();
});

When('Alice selects the chat session with Bob', async ({ alice }) => {
  await chatPage(alice.app.window).selectFirstSession();
});

When('Alice reacts with {string} to the message {string}', async ({ alice }, emoji: string, messageText: string) => {
  await chatPage(alice.app.window).reactToMessage(messageText, emoji);
});

Then("the reaction {string} is visible in Alice's chat", async ({ alice }, emoji: string) => {
  await expect(chatPage(alice.app.window).reactionPillByEmoji(emoji)).toBeVisible({ timeout: LONG_TIMEOUT });
});

Then("the reaction {string} is visible in Bob's chat", async ({ bob }, emoji: string) => {
  await expect(chatPage(bob.app.window).reactionPillByEmoji(emoji)).toBeVisible({ timeout: LONG_TIMEOUT });
});

When('Alice sends the message {string}', async ({ alice }, text: string) => {
  await chatPage(alice.app.window).sendMessage(text);
});

Then("the message {string} is visible in Alice's chat", async ({ alice }, text: string) => {
  await expect(alice.app.window.getByText(text).last()).toBeVisible({ timeout: LONG_TIMEOUT });
});

// ─── Bob actions ───────────────────────────────────────────────────────────

When('Bob opens the chat as a tab', async ({ bob }) => {
  await chatPage(bob.app.window).openFullscreen();
});

When('Bob opens the new requests list', async ({ bob }) => {
  const newRequestsItem = bob.app.window.getByTestId(TEST_IDS.chatNewRequestsItem);
  await expect(newRequestsItem).toBeVisible({ timeout: VERY_LONG_TIMEOUT });
  await newRequestsItem.click();
});

When('Bob accepts the incoming request', async ({ bob }) => {
  // `.first()` defends against `submitRequest`'s retry loop occasionally
  // posting a duplicate statement on slow UI confirmation — cross-scenario
  // pollution is already prevented by handing each test a fresh identity pair
  // from the pool (see `chatPair.ts:pairAssignment`).
  const acceptButton = bob.app.window.getByTestId(TEST_IDS.chatRequestAcceptButton).first();
  await expect(acceptButton).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  await acceptButton.locator('button').click();
});

Then("a chat session with Alice appears in Bob's chat sidebar", async ({ bob }) => {
  // The ChatItem's name is empty because P2P requests don't carry the
  // requester's own username, so we assert on presence rather than name match.
  await expect(chatPage(bob.app.window).roomItems).toHaveCount(1, { timeout: VERY_LONG_TIMEOUT });
});

When('Bob selects the chat session with Alice', async ({ bob }) => {
  await chatPage(bob.app.window).selectFirstSession();
});

When('Bob sends the message {string}', async ({ bob }, text: string) => {
  await chatPage(bob.app.window).sendMessage(text);
});

Then("the message {string} is visible in Bob's chat", async ({ bob }, text: string) => {
  await expect(bob.app.window.getByText(text).last()).toBeVisible({ timeout: LONG_TIMEOUT });
});
