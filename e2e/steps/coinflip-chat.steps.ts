import { createBdd } from 'playwright-bdd';

import { TEST_IDS } from '@/shared/test-ids';
import { authenticatedTest, expect } from '../fixtures/authenticated';
import { DEFAULT_TIMEOUT } from '../helpers/timeouts';
import { BrowserPage } from '../page-objects/BrowserPage';
import { ChatPage } from '../page-objects/ChatPage';
import { DashboardPage } from '../page-objects/DashboardPage';
import { ProductActionsPage } from '../page-objects/ProductActionsPage';

const { When, Then } = createBdd(authenticatedTest);

/**
 * Opens a product in a new browser tab via the address bar.
 */
When('the user opens {string} in a new tab', async ({ authenticatedApp }, domain: string) => {
  const browser = new BrowserPage(authenticatedApp.window, authenticatedApp.app);
  await browser.openProductInNewTab(domain);
});

/**
 * Opens the product actions menu (•••), clicks "Add to dashboard", selects the
 * requested size chip, confirms via the per-card "Add" button,
 * and dismisses the modal with Escape.
 *
 * The AddressBarInstallButton was removed in favour of the product actions menu
 * (•••) flow: open the trigger → click "Add to dashboard" → interact with the
 * FavoriteSizeSelectorModal as before.
 *
 * The modal (FavoriteSizeSelectorModal):
 *  - size labels: `Small` / `Medium` / `Large` / `Horizontal`
 *    (`Large` = 1×8, replacing the old "Full"),
 *  - the per-card action is a text button labeled `Add` (or `Open` when the
 *    widget is already on the dashboard).
 *
 * The modal no longer has explicit Close/Done buttons — it dismisses via
 * Escape or click-outside (standard Radix Dialog behavior).
 *
 * The dialog locator is filtered by the always-present `Add to Favorites`
 * button so a leftover permission/error dialog can't shadow our scope.
 *
 * Permission/alias dialogs that products raise on widget mount are
 * auto-approved by the renderer-side observer in `helpers/dialogs.ts`,
 * so this step doesn't need to handle them.
 */
When('the user adds the current tab to favorites as a {string} widget', async ({ authenticatedApp }, sizeLabel: string) => {
  const page = authenticatedApp.window;

  const menuTrigger = page.getByTestId(TEST_IDS.productActionsMenuTrigger);
  await expect(menuTrigger).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  await menuTrigger.click();

  const addToDashboardItem = page.getByRole('menuitem', { name: 'Add to dashboard', exact: true });
  await expect(addToDashboardItem).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  await addToDashboardItem.click();

  // Scope to the FavoriteSizeSelectorModal — uniquely identified by its
  // "Add to Favorites" button (or "Added to Favorites" once the product is
  // already favourited; the check below tolerates either label).
  const dialog = page.getByRole('dialog').filter({
    has: page.getByRole('button', { name: /^Add(ed)? to Favorites$/ }),
  });
  await expect(dialog).toBeVisible({ timeout: DEFAULT_TIMEOUT });

  const sizeChip = dialog.getByRole('button', { name: sizeLabel, exact: true });
  await expect(sizeChip).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  await sizeChip.click();
  await expect(sizeChip).toHaveAttribute('aria-pressed', 'true');

  const addWidgetButton = dialog.getByRole('button', { name: 'Add', exact: true });
  await expect(addWidgetButton).toBeEnabled({ timeout: DEFAULT_TIMEOUT });
  await addWidgetButton.click();

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden({ timeout: DEFAULT_TIMEOUT });
});

/**
 * Establishes the product chat session via the ••• product actions menu's
 * "Proceed in Chat" action. Product rooms are declared in-memory on worker load
 * and only persisted — and thus shown in Quick Chat — once the user confirms
 * this dialog, so the test must perform it explicitly before the session appears.
 */
When('the user starts a chat with the product', async ({ authenticatedApp }) => {
  const actions = new ProductActionsPage(authenticatedApp.window);
  await actions.proceedInChat();
});

/**
 * Navigates back to the dashboard via the home button in the top bar.
 */
When('the user navigates to the dashboard', async ({ authenticatedApp }) => {
  const dashboard = new DashboardPage(authenticatedApp.window);
  await dashboard.navigateToDashboard();
});

When('the {string} chat session appears in the chat widget', async ({ authenticatedApp }, sessionName: string) => {
  const chat = new ChatPage(authenticatedApp.window);
  await chat.waitForSessionInWidget(sessionName);
});

When('the user selects the {string} chat session in the chat widget', async ({ authenticatedApp }, sessionName: string) => {
  const chat = new ChatPage(authenticatedApp.window);
  await chat.selectSessionInWidget(sessionName);
});

When('the user sends the message {string}', async ({ authenticatedApp }, message: string) => {
  const chat = new ChatPage(authenticatedApp.window);
  await chat.sendMessage(message);
});

Then('the message {string} is visible in the chat', async ({ authenticatedApp }, message: string) => {
  // The last occurrence covers cases where the same message was sent in a previous run
  await expect(authenticatedApp.window.getByText(message).last()).toBeVisible({ timeout: DEFAULT_TIMEOUT });
});

Then('a screenshot is taken as {string}', async ({ authenticatedApp, $testInfo }, name: string) => {
  const screenshot = await authenticatedApp.window.screenshot();
  await $testInfo.attach(`${name}-${process.platform}`, { body: screenshot, contentType: 'image/png' });
});
