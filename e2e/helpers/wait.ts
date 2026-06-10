import { type Page } from '@playwright/test';

/**
 * Wait for a selector to appear
 */
export async function waitForSelector(page: Page, selector: string, options?: { timeout?: number }) {
  return await page.waitForSelector(selector, options);
}

/**
 * Wait for navigation to complete
 */
export async function waitForNavigation(page: Page, options?: { url?: string | RegExp; timeout?: number }) {
  return await page.waitForURL(options?.url || /.*/, { timeout: options?.timeout });
}

/**
 * Wait for a specific network request
 */
export async function waitForRequest(page: Page, urlPattern: string | RegExp, options?: { timeout?: number }) {
  return await page.waitForRequest(urlPattern, options);
}

/**
 * Wait for a specific network response
 */
export async function waitForResponse(page: Page, urlPattern: string | RegExp, options?: { timeout?: number }) {
  return await page.waitForResponse(urlPattern, options);
}

/**
 * Wait for a custom condition
 */
export async function waitForCondition(
  condition: () => boolean | Promise<boolean>,
  options?: { timeout?: number; interval?: number },
): Promise<void> {
  const { timeout = 5000, interval = 100 } = options ?? {};
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }

  throw new Error('Timeout waiting for condition');
}

/**
 * Wait for element to be visible and stable
 */
export async function waitForStableElement(page: Page, selector: string, options?: { timeout?: number }) {
  const element = await page.waitForSelector(selector, {
    state: 'visible',
    ...options,
  });
  // Wait for animations to complete
  await page.waitForTimeout(100);
  return element;
}

/**
 * Wait for page to be idle (no network activity)
 */
export async function waitForIdle(page: Page, timeout: number = 10_000) {
  await page.waitForLoadState('domcontentloaded', { timeout });
}

/**
 * Retry an action until it succeeds
 */
export async function retry<T>(
  action: () => Promise<T>,
  options?: {
    maxAttempts?: number;
    delay?: number;
    onError?: (error: Error, attempt: number) => void;
  },
): Promise<T> {
  const { maxAttempts = 3, delay = 1000, onError } = options || {};

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await action();
    } catch (error) {
      if (attempt === maxAttempts) {
        throw error;
      }
      if (onError) {
        onError(error instanceof Error ? error : new Error(String(error)), attempt);
      }
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw new Error('Should not reach here');
}
