import { type Page, expect } from '@playwright/test';

import { TEST_IDS } from '@/shared/test-ids';
import { DEFAULT_TIMEOUT, LONG_TIMEOUT } from '../helpers/timeouts';

/**
 * Page Object for the toolbar-launched Add Widget modal (`AddWidgetModalDb`):
 * the sidebar catalog of widget-capable entries plus its search box.
 *
 * The catalog always contains the native "Favorites" entry; published widget
 * products (e.g. CoinFlip) are fetched from chain when the modal opens, so waits
 * over them use `LONG_TIMEOUT`.
 */
export class AddWidgetModalPage {
  constructor(private readonly page: Page) {}

  get dialog() {
    return this.page.getByRole('dialog');
  }

  get searchInput() {
    return this.page.getByTestId(TEST_IDS.addWidgetSearchInput);
  }

  get sidebarItems() {
    return this.page.getByTestId(TEST_IDS.addWidgetSidebarItem);
  }

  get noResults() {
    return this.page.getByTestId(TEST_IDS.addWidgetNoResults);
  }

  async expectOpen() {
    await expect(this.dialog).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    await expect(this.searchInput).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  }

  /** Catalog is populated when at least one sidebar entry renders. */
  async expectCatalogPopulated() {
    await expect(this.sidebarItems.first()).toBeVisible({ timeout: LONG_TIMEOUT });
  }

  async search(query: string) {
    await this.searchInput.fill(query);
  }

  /** At least one entry whose label/baseName matches the query is listed. */
  async expectMatchVisible(label: string) {
    await expect(this.sidebarItems.filter({ hasText: label }).first()).toBeVisible({ timeout: LONG_TIMEOUT });
  }

  async expectNoResults() {
    await expect(this.noResults).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    await expect(this.sidebarItems).toHaveCount(0);
  }

  /**
   * Add a native (non-product) catalog card — e.g. the Chat widget. Selects the
   * sidebar entry whose label exactly matches `catalogLabel`, picks `sizeLabel`
   * if that chip is offered, then clicks Add. The modal does NOT auto-close on
   * add (the host only mutates the layout), so callers dismiss it afterwards.
   */
  async addNativeWidget(catalogLabel: string, sizeLabel = 'Large') {
    await this.expectCatalogPopulated();
    const entry = this.sidebarItems.filter({ has: this.page.getByText(catalogLabel, { exact: true }) }).first();
    await expect(entry).toBeVisible({ timeout: LONG_TIMEOUT });
    await entry.click();

    const sizeChip = this.dialog.getByRole('button', { name: sizeLabel, exact: true });
    if ((await sizeChip.count()) > 0) await sizeChip.first().click();

    const addButton = this.dialog.getByRole('button', { name: 'Add', exact: true });
    await expect(addButton).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    await addButton.click();

    await this.page.keyboard.press('Escape');
    await expect(this.dialog).toBeHidden({ timeout: DEFAULT_TIMEOUT });
  }
}
