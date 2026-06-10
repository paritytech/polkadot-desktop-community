import { createBdd } from 'playwright-bdd';

import { expect, test } from '../fixtures/base';
import { OnboardingPage } from '../page-objects/OnboardingPage';

const { Given, When, Then } = createBdd(test);

Then('the QR code is visible on onboarding screen', async ({ electronApp }) => {
  const onboarding = new OnboardingPage(electronApp.window);
  await onboarding.waitForQrCode();
});

Then('the QR code width is at least {int}', async ({ electronApp }, minWidth: number) => {
  const onboarding = new OnboardingPage(electronApp.window);
  const { width } = await onboarding.getQrDimensions();
  expect(width).toBeGreaterThanOrEqual(minWidth);
});

Then('the QR code height is at least {int}', async ({ electronApp }, minHeight: number) => {
  const onboarding = new OnboardingPage(electronApp.window);
  const { height } = await onboarding.getQrDimensions();
  expect(height).toBeGreaterThanOrEqual(minHeight);
});

Given('the QR code is displayed on onboarding screen', async ({ electronApp }) => {
  const onboarding = new OnboardingPage(electronApp.window);
  await onboarding.waitForQrCode();
});

When('the user skips onboarding', async ({ electronApp }) => {
  const onboarding = new OnboardingPage(electronApp.window);
  await onboarding.skipOnboarding();
});
