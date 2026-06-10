import { type Page, expect } from '@playwright/test';

/**
 * Assert that the window title contains the expected text
 */
export async function expectWindowTitle(page: Page, title: string | RegExp) {
  await expect(page).toHaveTitle(title);
}

/**
 * Assert that an element is visible
 */
export async function expectVisible(page: Page, selector: string) {
  await expect(page.locator(selector)).toBeVisible();
}

/**
 * Assert that an element is hidden
 */
export async function expectHidden(page: Page, selector: string) {
  await expect(page.locator(selector)).toBeHidden();
}

/**
 * Assert that an element contains text
 */
export async function expectText(page: Page, selector: string, text: string | RegExp) {
  await expect(page.locator(selector)).toContainText(text);
}

/**
 * Assert that an element has an attribute with a value
 */
export async function expectAttribute(page: Page, selector: string, attribute: string, value: string | RegExp) {
  await expect(page.locator(selector)).toHaveAttribute(attribute, value);
}

/**
 * Assert that a URL matches the expected pattern
 */
export async function expectURL(page: Page, url: string | RegExp) {
  await expect(page).toHaveURL(url);
}

/**
 * Assert that an element count matches
 */
export async function expectCount(page: Page, selector: string, count: number) {
  await expect(page.locator(selector)).toHaveCount(count);
}

/**
 * Wait for network request and validate
 */
export async function expectRequest(
  page: Page,
  urlPattern: string | RegExp,
  validate?: (request: Awaited<ReturnType<Page['waitForRequest']>>) => void,
) {
  const request = await page.waitForRequest(urlPattern);
  if (validate) {
    validate(request);
  }
  return request;
}

/**
 * Wait for network response and validate
 */
export async function expectResponse(
  page: Page,
  urlPattern: string | RegExp,
  validate?: (response: Awaited<ReturnType<Page['waitForResponse']>>) => void,
) {
  const response = await page.waitForResponse(urlPattern);
  if (validate) {
    validate(response);
  }
  return response;
}

/**
 * Assert console message appears
 */
export async function expectConsoleMessage(
  page: Page,
  messagePattern: string | RegExp,
  type?: 'log' | 'warning' | 'error' | 'info',
) {
  return new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Console message not found: ${messagePattern}`));
    }, 5000);

    page.on('console', msg => {
      if (type && msg.type() !== type) return;

      const text = msg.text();
      const matches = typeof messagePattern === 'string' ? text.includes(messagePattern) : messagePattern.test(text);

      if (matches) {
        clearTimeout(timeout);
        resolve();
      }
    });
  });
}
