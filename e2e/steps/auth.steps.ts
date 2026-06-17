import { createBdd } from 'playwright-bdd';

import { expect, test } from '../fixtures/base';
import { type E2eEnvironmentId, envToBotNetwork } from '../helpers/environment';
import { DEFAULT_TIMEOUT, VERY_LONG_TIMEOUT } from '../helpers/timeouts';
import { DashboardPage } from '../page-objects/DashboardPage';
import { OnboardingPage } from '../page-objects/OnboardingPage';
import { UserPopover } from '../page-objects/UserPopover';

const { Given, When, Then } = createBdd(test);

function parseEnvironmentId(value: string): E2eEnvironmentId {
  if (value === 'nightly' || value === 'unstable') {
    return value;
  }
  throw new Error(`Unknown environment id: "${value}". Expected nightly | unstable.`);
}

Given('the user selects the {string} environment', async ({ electronApp }, environment: string) => {
  const onboarding = new OnboardingPage(electronApp.window);
  await onboarding.selectEnvironment(parseEnvironmentId(environment));
});

When(
  'the user pairs via signing bot on {string}',
  async ({ electronApp, botUrl, botUsername, botUserSession }, environment: string) => {
    const envId = parseEnvironmentId(environment);
    await botUserSession.ensure(envToBotNetwork(envId));
    const onboarding = new OnboardingPage(electronApp.window);
    await onboarding.connectViaBot(botUrl, botUsername);
  },
);

Given(
  'the user is signed in via signing bot on {string}',
  async ({ electronApp, botUrl, botUsername, botUserSession }, environment: string) => {
    const envId = parseEnvironmentId(environment);
    await botUserSession.ensure(envToBotNetwork(envId));
    const onboarding = new OnboardingPage(electronApp.window);
    await onboarding.waitForQrCode();
    await onboarding.connectViaBot(botUrl, botUsername);

    await electronApp.window.waitForURL(/dashboard/, { timeout: VERY_LONG_TIMEOUT });
  },
);

Given(
  'the user is signed in on {string} via signing bot',
  async ({ electronApp, botUrl, botUsername, botUserSession }, environment: string) => {
    const envId = parseEnvironmentId(environment);
    await botUserSession.ensure(envToBotNetwork(envId));
    const onboarding = new OnboardingPage(electronApp.window);
    await onboarding.selectEnvironment(envId);
    await onboarding.waitForQrCode();
    await onboarding.connectViaBot(botUrl, botUsername);

    await electronApp.window.waitForURL(/dashboard/, { timeout: VERY_LONG_TIMEOUT });
  },
);

Then('the user is redirected to dashboard', async ({ electronApp }) => {
  await electronApp.window.waitForURL(/dashboard/, { timeout: VERY_LONG_TIMEOUT });
});

Then('session data exists in localStorage', async ({ electronApp }) => {
  const pappKeys = await electronApp.window.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('polkadot_')));
  expect(pappKeys.length).toBeGreaterThan(0);
});

Then('user info is visible in the top bar', async ({ electronApp }) => {
  const dashboard = new DashboardPage(electronApp.window);
  await expect(dashboard.userButton).toBeVisible({ timeout: DEFAULT_TIMEOUT });
});

When('the user clicks logout', async ({ electronApp }) => {
  const dashboard = new DashboardPage(electronApp.window);
  const popover = new UserPopover(electronApp.window);

  await dashboard.clickUserButton();
  await popover.logout();
});

Then('session data is removed from localStorage', async ({ electronApp }) => {
  // Logout disconnects asynchronously and redirects to onboarding; the navigation can
  // destroy the evaluate execution context mid-call. Retry until the page settles and
  // localStorage is cleared.
  await expect(async () => {
    const pappKeys = await electronApp.window.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('polkadot_')));
    expect(pappKeys.length).toBe(0);
  }).toPass({ timeout: DEFAULT_TIMEOUT });
});

Then('user secrets are removed from localStorage', async ({ electronApp }) => {
  // See note above: logout triggers a redirect, so retry across the navigation.
  await expect(async () => {
    const secretKeys = await electronApp.window.evaluate(() => Object.keys(localStorage).filter(k => k.includes('userSecret')));
    expect(secretKeys.length).toBe(0);
  }).toPass({ timeout: DEFAULT_TIMEOUT });
});

Then('the user is redirected to onboarding screen', async ({ electronApp }) => {
  await electronApp.window.waitForURL(/onboarding/, { timeout: DEFAULT_TIMEOUT });
});
