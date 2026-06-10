import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

import { type Page, test as playwright } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

import { type ElectronAppContext, closeElectronApp, launchElectronApp } from '../helpers/electron';
import { type ProbeResult, injectAndLoadProduct, waitForProbeResults } from '../helpers/webview';

import { setupPlatformParameter } from './allure-metadata';

/**
 * Read files from a directory and return as number[] arrays (serializable).
 */
export function readProductFiles(dirPath: string): Record<string, number[]> {
  const files: Record<string, number[]> = {};
  const entries = fs.readdirSync(dirPath);

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry);
    const stat = fs.statSync(fullPath);
    if (stat.isFile()) {
      const content = fs.readFileSync(fullPath);
      files[entry] = Array.from(content);
    }
  }

  return files;
}

/**
 * Inject a test product into the running Electron app.
 * Stores archive in main process + creates a raw webview element.
 */
export async function injectProduct(window: Page, domain: string, dirPath: string) {
  const files = readProductFiles(dirPath);
  await injectAndLoadProduct(window, domain, files);
}

/**
 * Worker-scoped fixtures shared across all security probe tests.
 * Launches Electron once, injects the probe product, collects all results,
 * then shares them with every test in the worker.
 */
type SecurityWorkerFixtures = {
  securityContext: {
    electronApp: ElectronAppContext;
    probeResults: Record<string, ProbeResult>;
    userDataDir: string;
  };
};

type SecurityTestFixtures = {
  probeResults: Record<string, ProbeResult>;
};

export const securityTest = playwright.extend<SecurityTestFixtures, SecurityWorkerFixtures>({
  // Worker-scoped: one Electron launch + probe run shared across all tests
  securityContext: [
    // eslint-disable-next-line no-empty-pattern -- Playwright requires object destructuring
    async ({}, use) => {
      const userDataDir = path.join(os.tmpdir(), 'polkadot-desktop-e2e-security', `worker-${Date.now()}`);
      fs.mkdirSync(userDataDir, { recursive: true });

      const electronApp = await launchElectronApp({
        userDataDir,
      });

      const { window } = electronApp;

      const probePath = path.resolve(__dirname, '../test-products/security-probe');
      const domain = 'security-probe.test';
      const files = readProductFiles(probePath);

      // Start listening for probe results BEFORE creating the webview
      const resultsPromise = waitForProbeResults(window, 90_000);

      // Inject archive + create webview
      await injectAndLoadProduct(window, domain, files);

      // Wait for all probes to complete
      const probeResults = await resultsPromise;

      await use({ electronApp, probeResults, userDataDir });

      await closeElectronApp(electronApp);

      try {
        fs.rmSync(userDataDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    },
    { scope: 'worker' },
  ],

  // Test-scoped: just forward the worker-scoped probe results
  probeResults: async ({ securityContext }, use) => {
    await setupPlatformParameter();
    await use(securityContext.probeResults);
  },
});

export { expect } from '@playwright/test';
