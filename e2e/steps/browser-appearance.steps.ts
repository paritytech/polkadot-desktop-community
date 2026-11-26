import { createBdd } from 'playwright-bdd';

import { test } from '../fixtures/link-tests';
import { DEFAULT_TIMEOUT } from '../helpers/timeouts';
import { AppearancePage } from '../page-objects/AppearancePage';

const { When, Then } = createBdd(test);

// Captured just before a theme card is clicked so the palette-change assertion
// has a baseline. Module state is safe here: scenarios within a worker run
// serially, and each step pair lives in the same scenario.
let paletteBeforeThemeSelect = '';

When('the user opens the browser appearance settings', async ({ electronApp }) => {
  await new AppearancePage(electronApp.window).open();
});

// The hash route survives a reload, so the app lands straight back on the
// appearance page — no dashboard round-trip (unlike the seed-steps reload,
// which expects a /dashboard|new-tab prior route).
When('the app reloads back to the appearance settings', async ({ electronApp }) => {
  const page = electronApp.window;
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForURL(/settings\/appearance/, { timeout: DEFAULT_TIMEOUT });
});

// --- Color mode (Device / Day / Night) --------------------------------------

Then('the browser color mode options Device, Day and Night are available', async ({ electronApp }) => {
  await new AppearancePage(electronApp.window).expectColorModesVisible(['Device', 'Day', 'Night']);
});

When('the user selects the {string} browser color mode', async ({ electronApp }, name: string) => {
  await new AppearancePage(electronApp.window).selectColorMode(name);
});

Then('the {string} browser color mode is selected', async ({ electronApp }, name: string) => {
  await new AppearancePage(electronApp.window).expectColorModeSelected(name);
});

Then('the app renders in dark appearance', async ({ electronApp }) => {
  await new AppearancePage(electronApp.window).expectAppliedMode('dark');
});

Then('the app renders in light appearance', async ({ electronApp }) => {
  await new AppearancePage(electronApp.window).expectAppliedMode('light');
});

// --- Theme picker (Berlin / Tokyo / Lisbon / Malta) -------------------------

Then('the browser theme options Berlin, Tokyo, Lisbon and Malta are available', async ({ electronApp }) => {
  await new AppearancePage(electronApp.window).expectRadiosVisible(['Berlin', 'Tokyo', 'Lisbon', 'Malta']);
});

When('the user selects the {string} browser theme', async ({ electronApp }, name: string) => {
  const appearance = new AppearancePage(electronApp.window);
  paletteBeforeThemeSelect = await appearance.readPaletteVar();
  await appearance.selectRadio(name);
});

Then('the {string} browser theme is selected', async ({ electronApp }, name: string) => {
  await new AppearancePage(electronApp.window).expectRadioSelected(name);
});

Then('the applied theme palette is updated', async ({ electronApp }) => {
  await new AppearancePage(electronApp.window).expectPaletteChangedFrom(paletteBeforeThemeSelect);
});

// --- Preview ----------------------------------------------------------------

Then('the theme preview is displayed', async ({ electronApp }) => {
  await new AppearancePage(electronApp.window).expectPreviewVisible();
});
