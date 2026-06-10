import { createBdd } from 'playwright-bdd';

import { TEST_IDS } from '@/shared/test-ids';
import { e2eConfig } from '../config';
import { authenticatedTest, expect } from '../fixtures/authenticated';
import { type ChatBotNetwork, ChatBotClient } from '../helpers/chatBotClient';
import { resetDesktopChatState } from '../helpers/chatState';
import { DEFAULT_TIMEOUT, LONG_TIMEOUT, VERY_LONG_TIMEOUT } from '../helpers/timeouts';
import { ChatPage } from '../page-objects/ChatPage';
import { ContactSearchPage } from '../page-objects/ContactSearchPage';

const { Given, When, Then } = createBdd(authenticatedTest);

/**
 * Chat-peer identity on the signing-bot. A single identity is reused across
 * runs and workers — the bot creates idempotently and attestation is cached.
 */
const PEER_BOT_USERNAME = process.env['CHAT_PEER_BOT_USERNAME'] ?? 'desktoptest-chatpeer';
const PEER_BOT_LITE_USERNAME = process.env['CHAT_PEER_BOT_LITE_USERNAME'] ?? 'dtchatpeer';
const PEER_BOT_NETWORK: ChatBotNetwork = parseNetwork(process.env['CHAT_PEER_BOT_NETWORK']);

/**
 * The user's bot-side identity — must match botUsername configured in playwright.config
 * for the `authenticated` project. The user was attested under this name during sign-in.
 */
const USER_BOT_USERNAME = 'desktoptest-authenticated';

function parseNetwork(value: string | undefined): ChatBotNetwork {
  if (value === 'stable' || value === 'preview' || value === 'unstable' || value === 'paseo-next') {
    return value;
  }
  return 'paseo-next';
}

let peerClient: ChatBotClient | undefined;
/** Bot identity's own liteUsername — the name shown in the user's chat UI (the "other side"). */
let peerBotLiteUsername: string | undefined;
/** User identity's liteUsername — the name the bot uses to address the user in its own API. */
let userLiteUsername: string | undefined;

function getClient(): ChatBotClient {
  if (!peerClient) {
    peerClient = new ChatBotClient(e2eConfig.botUrl, process.env['BOT_TOKEN']);
  }
  return peerClient;
}

Given('the chat peer bot is ready and listening', async () => {
  const client = getClient();
  const { liteUsername } = await client.ensurePeerReady({
    username: PEER_BOT_USERNAME,
    liteUsername: PEER_BOT_LITE_USERNAME,
    network: PEER_BOT_NETWORK,
  });
  peerBotLiteUsername = liteUsername;
  await client.startDiscovery(PEER_BOT_USERNAME, PEER_BOT_NETWORK);
});

Given('no chat session exists with the peer bot', async ({ authenticatedApp }) => {
  // Bot-side: drop every session owned by the peer bot identity.
  await getClient().deleteAllSessionsForUser(PEER_BOT_USERNAME);
  // Desktop-side: wipe the Dexie p2p-chat store + reload + land on dashboard.
  await resetDesktopChatState(authenticatedApp.window);
});

Given('the peer bot has sent a chat request to the user', async () => {
  const client = getClient();
  // Resolve the user's liteUsername via the user's own bot identity (created at sign-in).
  const userStatus = await client.getChatStatus(USER_BOT_USERNAME, PEER_BOT_NETWORK);
  if (!userStatus.chatReady || !userStatus.liteUsername) {
    throw new Error(
      `User "${USER_BOT_USERNAME}@${PEER_BOT_NETWORK}" is not chat-ready on the bot. ` +
        `Make sure the authenticated sign-in flow attested the user. status=${JSON.stringify(userStatus)}`,
    );
  }
  userLiteUsername = userStatus.liteUsername;
  await client.createSessionWithPeer({
    username: PEER_BOT_USERNAME,
    network: PEER_BOT_NETWORK,
    peer: userStatus.liteUsername,
  });
});

When('the user opens the chat as a tab', async ({ authenticatedApp }) => {
  const chat = new ChatPage(authenticatedApp.window);
  await chat.openFullscreen();
});

When('the user opens the contact search', async ({ authenticatedApp }) => {
  const search = new ContactSearchPage(authenticatedApp.window);
  await search.openFromFullscreen();
});

When('the user opens the new requests list', async ({ authenticatedApp }) => {
  const page = authenticatedApp.window;
  const newRequestsItem = page.getByTestId(TEST_IDS.chatNewRequestsItem);
  await expect(newRequestsItem).toBeVisible({ timeout: VERY_LONG_TIMEOUT });
  await newRequestsItem.click();
});

When('the user accepts the request from the peer bot', async ({ authenticatedApp }) => {
  const acceptButton = authenticatedApp.window.getByTestId(TEST_IDS.chatRequestAcceptButton);
  await expect(acceptButton).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  await acceptButton.locator('button').click();
});

When("the user types the peer bot's lite username into the contact search", async ({ authenticatedApp }) => {
  const search = new ContactSearchPage(authenticatedApp.window);
  await search.typeQuery(expectLiteUsername());
});

Then('the contact search shows the peer bot as a result', async ({ authenticatedApp }) => {
  const search = new ContactSearchPage(authenticatedApp.window);
  await search.waitForResult(expectLiteUsername());
});

When('the user selects the peer bot from the results', async ({ authenticatedApp }) => {
  const search = new ContactSearchPage(authenticatedApp.window);
  await search.selectResult(expectLiteUsername());
});

When('the user types {string} into the welcome message field', async ({ authenticatedApp }, text: string) => {
  const search = new ContactSearchPage(authenticatedApp.window);
  await search.fillWelcome(text);
});

When('the user clicks "Send Request"', async ({ authenticatedApp }) => {
  const search = new ContactSearchPage(authenticatedApp.window);
  await search.submitRequest();
});

Then('a chat session with the peer bot appears in the chat sidebar', async ({ authenticatedApp }) => {
  const chat = new ChatPage(authenticatedApp.window);
  // Wait for an actual ChatItem (accepted session), NOT just any text match
  // — the sidebar also contains outgoing-request placeholders that don't
  // expose a message input.
  await expect(chat.roomItemByName(expectLiteUsername())).toBeVisible({ timeout: VERY_LONG_TIMEOUT });
});

When('the user selects the chat session with the peer bot', async ({ authenticatedApp }) => {
  const chat = new ChatPage(authenticatedApp.window);
  await chat.selectSession(expectLiteUsername());
});

Then(
  'the peer bot receives the message {string}', // eslint-disable-next-line no-empty-pattern -- step has no fixture deps
  async ({}, text: string) => {
    await getClient().waitForIncomingMessage({
      username: PEER_BOT_USERNAME,
      peer: expectUserLiteUsername(),
      network: PEER_BOT_NETWORK,
      text,
      timeoutMs: LONG_TIMEOUT,
    });
  },
);

When(
  'the peer bot sends the message {string} to the user', // eslint-disable-next-line no-empty-pattern -- step has no fixture deps
  async ({}, text: string) => {
    await getClient().sendMessage({
      username: PEER_BOT_USERNAME,
      peer: expectUserLiteUsername(),
      network: PEER_BOT_NETWORK,
      text,
    });
  },
);

function expectLiteUsername(): string {
  if (!peerBotLiteUsername) {
    throw new Error(
      '[chat-p2p.steps] Peer bot lite username not resolved. "Given the chat peer bot is ready and listening" must run first.',
    );
  }
  return peerBotLiteUsername;
}

function expectUserLiteUsername(): string {
  if (!userLiteUsername) {
    throw new Error(
      '[chat-p2p.steps] User lite username not resolved. "Given the peer bot has sent a chat request to the user" must run first.',
    );
  }
  return userLiteUsername;
}
