import { type Page, expect } from '@playwright/test';

import { TEST_IDS } from '@/shared/test-ids';
import { DEFAULT_TIMEOUT } from '../helpers/timeouts';

/**
 * The per-app and per-permission settings entity pages under
 * /settings/privacy/{apps,permissions}.
 *
 * These pages are populated only by products that have *requested* a
 * permission, so a test must first drive a product (host-playground) to grant
 * one before any of these pages list anything. See permission-settings.feature.
 *
 * Rows on the apps list (`ProductListSettingsPage`) and the permission list
 * (`PermissionListPage`) render as `ListItem` buttons with no test-id;
 * they are matched by their visible product/permission text (the click bubbles
 * to the button). The modality status rows and the reset button on the
 * per-app entity page do carry test-ids.
 */
export class PermissionSettingsPage {
  constructor(private readonly page: Page) {}

  // --- Apps list (/settings/privacy/apps) -----------------------------------

  /**
   * Filter the apps list to the given query and open the matching app's
   * settings page. The list may also carry default/committed products, so the
   * search box is used to isolate the target row first.
   */
  async openAppFromList(query: string) {
    const search = this.page.getByRole('searchbox');
    await expect(search).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    await search.fill(query);

    const row = this.page.getByText(query, { exact: false }).first();
    await expect(row).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    await row.click();
  }

  // --- Per-app settings page (/settings/privacy/apps/<id>) -------------------

  /** Assert the "Requested permissions" list contains a row for the permission. */
  async expectRequestedPermission(label: string) {
    await expect(this.page.getByText('Requested permissions', { exact: true })).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    await expect(this.permissionEntryButton(label)).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  }

  private permissionEntryButton(label: string) {
    return this.page.getByRole('button').filter({ has: this.page.getByText(label, { exact: true }) });
  }

  /** Open the per-permission entity page for a requested permission of this app. */
  async openPermissionEntity(label: string) {
    await this.permissionEntryButton(label).first().click();
    await expect(this.resetButton).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  }

  // --- Per-app permission entity page ---------------------------------------

  // One row per permission. A stored decision no longer carries a surface, so the
  // per-modality rows this used to pick the first of are gone.
  private get permissionRow() {
    return this.page.getByTestId(TEST_IDS.permissionRow).first();
  }

  private get resetButton() {
    return this.page.getByTestId(TEST_IDS.permissionResetButton);
  }

  /** Change the permission's status via its dropdown. */
  async setStatus(status: string) {
    await this.permissionRow.getByRole('button').first().click();
    await this.page.getByRole('menuitem', { name: status, exact: true }).click();
    await this.expectStatus(status);
  }

  /** Assert the permission's dropdown shows the given status. */
  async expectStatus(status: string) {
    await expect(this.permissionRow.getByRole('button').first()).toContainText(status, { timeout: DEFAULT_TIMEOUT });
  }

  /** Reset the permission to its default (Ask) status via the entity-page button. */
  async resetToDefault() {
    await expect(this.resetButton).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    await this.resetButton.click();
  }

  // --- Alias contexts (per-app "Alias" permission entity page) ---------------

  /** Open the "Alias contexts" management dialog from the alias entity page. */
  async openAliasContexts() {
    const contextsRow = this.page.getByRole('button').filter({ has: this.page.getByText('Alias contexts', { exact: true }) });
    await expect(contextsRow.first()).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    await contextsRow.first().click();
  }

  /** Assert the alias-contexts dialog opened and lists at least one granted context. */
  async expectAliasContextsDialog() {
    const dialog = this.page.getByRole('dialog').filter({ hasText: 'Manage Alias Context Access' });
    await expect(dialog).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    await expect(dialog.getByRole('button', { name: 'Allowed', exact: true }).first()).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  }

  // --- Permission list (/settings/privacy/permissions) ----------------------

  /** Assert every category heading is rendered on the permission list page. */
  async expectCategories(names: string[]) {
    for (const name of names) {
      await expect(this.page.getByText(name, { exact: false }).first()).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    }
  }

  /** Open a permission's detail page from the grouped permission list. */
  async openPermissionDetail(label: string) {
    await this.page.getByText(label, { exact: true }).first().click();
    await expect(this.page.getByRole('heading', { name: 'Apps', exact: true })).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  }

  // --- Permission detail page (apps using the permission) -------------------

  private appDetailButton(query: string) {
    return this.page.getByRole('button').filter({ has: this.page.getByText(query, { exact: false }) });
  }

  /** Assert an app is listed under the permission's "Apps" section. */
  async expectAppListed(query: string) {
    await expect(this.appDetailButton(query).first()).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  }

  /** Open the per-app permission entity page from the permission detail list. */
  async openAppFromDetail(query: string) {
    await this.appDetailButton(query).first().click();
    await expect(this.resetButton).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  }
}
