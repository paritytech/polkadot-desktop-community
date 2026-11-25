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
    expect(alice.liteUsername).toBeTruthy();
    expect(bob.liteUsername).toBeTruthy();
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

// Search and select by the FULL registered lite username ("truapitest….15"), not
// the bare base name: the backend can hold more than one registration of the
// same base name (each attest submission that lands appends a new numeric
// index), and a bare-name substring match then resolves to several results.
When("Alice types Bob's username into the contact search", async ({ alice, bob }) => {
  // Contact search resolves a peer through the identity registry, so an identity the
  // registry does not hold can never appear in a result list — retrying only spends the
  // timeout. This happens when `truapi-host` attests the account but its dotNS claim never
  // lands (`dotNS username did not appear on Asset Hub after attestation`), which is an
  // upstream condition this suite cannot repair.
  //
  // Only an explicit `false` skips. `null` means the registry could not answer, and a run
  // with no registry configured MUST still exercise this scenario on the fallback name.
  const unregistered = [alice, bob].filter(peer => peer.registrationConfirmed === false).map(peer => peer.liteUsername);
  chatPairTest.skip(
    unregistered.length > 0,
    `identity registry holds no registration for ${unregistered.join(' and ')} — contact search cannot resolve the peer`,
  );

  await searchPage(alice.app.window).typeQuery(bob.liteUsername);
});

When('Alice selects Bob from the search results', async ({ alice, bob }) => {
  const search = searchPage(alice.app.window);
  // On-chain username attestation may take longer than DEFAULT_TIMEOUT to
  // propagate to the indexer right after sign-in. The search never refetches on
  // its own, so re-issue the query until Bob appears instead of waiting on a
  // single stale lookup.
  await search.findResultByRetyping(bob.liteUsername);
  await search.selectResult(bob.liteUsername);
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
  // pollution is already limited by cycling each test onto a different identity
  // pair (see `chatPair.ts:pairHosts`).
  // Accept now lives in the opened request conversation (banner), so open the
  // request item first, then accept from the banner.
  const requestItem = bob.app.window.getByTestId(TEST_IDS.chatRequestItem).first();
  await expect(requestItem).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  await requestItem.click();
  const acceptButton = bob.app.window.getByTestId(TEST_IDS.chatRequestAcceptButton).first();
  await expect(acceptButton).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  await acceptButton.click();
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

// ─── Requests: incoming (Bob) ────────────────────────────────────────────────

Then("Bob's chat sidebar shows {int} new request", async ({ bob }, count: number) => {
  await chatPage(bob.app.window).expectNewRequestsCount(count);
});

Then("an incoming request is shown in Bob's requests list", async ({ bob }) => {
  await expect(chatPage(bob.app.window).requestAcceptButtons.first()).toBeVisible({ timeout: DEFAULT_TIMEOUT });
});

When('Bob declines the incoming request', async ({ bob }) => {
  await chatPage(bob.app.window).declineFirstRequest();
});

Then('Bob confirms the decline', async ({ bob }) => {
  await chatPage(bob.app.window).confirmDecline();
});

Then("no incoming requests remain in Bob's chat sidebar", async ({ bob }) => {
  await expect(chatPage(bob.app.window).requestDeclineButtons).toHaveCount(0, { timeout: DEFAULT_TIMEOUT });
});

// ─── Requests: outgoing (Alice) ──────────────────────────────────────────────

Then("Alice's outgoing request to Bob is listed in her chat sidebar", async ({ alice }) => {
  await expect(chatPage(alice.app.window).outgoingRequestItems).toHaveCount(1, { timeout: VERY_LONG_TIMEOUT });
});

When('Alice opens her outgoing request to Bob', async ({ alice }) => {
  await chatPage(alice.app.window).openFirstOutgoingRequest();
});

Then('Alice sees the outgoing pending request room', async ({ alice }) => {
  await expect(chatPage(alice.app.window).outgoingPendingRoom).toBeVisible({ timeout: DEFAULT_TIMEOUT });
});

When('Alice removes her outgoing request', async ({ alice }) => {
  await chatPage(alice.app.window).removeOutgoingRequest();
});

Then('Alice has no outgoing requests in her chat sidebar', async ({ alice }) => {
  await expect(chatPage(alice.app.window).outgoingRequestItems).toHaveCount(0, { timeout: DEFAULT_TIMEOUT });
});
