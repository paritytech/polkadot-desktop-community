import { type Page } from '@playwright/test';

/** One option of Settings → Appearance's "Color mode" group (Device / Day / Night). */
export function colorModeButton(page: Page, name: string) {
  return page.getByRole('group', { name: 'Color mode' }).getByRole('button', { name, exact: true });
}
