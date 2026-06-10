/**
 * Standalone script that launches the Electron app with Playwright Inspector in record mode.
 *
 * Usage:
 *   PWDEBUG=1 npx tsx e2e/tests/record.e2e.ts
 *
 * In the Inspector window, click the "Record" button to start recording actions.
 * When done, copy the generated code and adapt it into a BDD step / Page Object.
 */
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

import { _electron as electron } from '@playwright/test';

async function main() {
  const tmpDir = path.join(os.tmpdir(), 'polkadot-desktop-e2e', `record-${Date.now()}`);
  await fs.mkdir(tmpDir, { recursive: true });

  const electronPath = path.join(process.cwd(), 'release/build/main.cjs');

  const electronArgs =
    process.platform === 'linux'
      ? ['--no-sandbox', '--disable-gpu', electronPath]
      : [electronPath];

  const baseEnv = Object.fromEntries(
    Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined),
  );

  console.info('🚀 Launching Electron app for recording...');

  const app = await electron.launch({
    args: electronArgs,
    env: {
      ...baseEnv,
      NODE_ENV: 'test',
      E2E_TEST: 'true',
      AUTOTEST: 'true',
      ELECTRON_USER_DATA: tmpDir,
    },
    timeout: 30_000,
  });

  const window = await app.firstWindow({ timeout: 30_000 });
  await window.waitForLoadState('domcontentloaded');

  console.info('✅ App launched. Playwright Inspector should open — click "Record" to start capturing actions.');

  // Opens Playwright Inspector — use "Record" button to capture actions
  await window.pause();

  console.info('🔚 Closing app...');
  await app.close();

  await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
}

main().catch((err) => {
  console.error('Failed to launch recorder:', err);
  process.exit(1);
});
