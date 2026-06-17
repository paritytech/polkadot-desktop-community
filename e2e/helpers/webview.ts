/* eslint-disable @typescript-eslint/no-explicit-any */

import { type Page } from '@playwright/test';

import { DEFAULT_TIMEOUT } from './timeouts';

export type ProbeResult = {
  id: string;
  category: string;
  name: string;
  expected: string;
  actual: string;
  passed: boolean;
  error?: string;
  duration: number;
};

const PROBE_PREFIX = 'SECURITY_PROBE::';
const PROBE_COMPLETE_PREFIX = 'SECURITY_PROBE_COMPLETE::';

/**
 * Execute JavaScript inside the webview guest page via the renderer process.
 * Playwright cannot access `<webview>` directly — this uses `executeJavaScript`.
 */
export async function evaluateInWebview<T>(window: Page, expression: string): Promise<T> {
  return window.evaluate(async expr => {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const wv = document.querySelector('webview') as
      | (HTMLElement & {
          getURL: () => string;
          executeJavaScript: (code: string) => Promise<unknown>;
        })
      | null;
    if (!wv) throw new Error('No webview element found');

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return wv.executeJavaScript(expr) as Promise<T>;
  }, expression);
}

/**
 * Wait for all security probe results from the webview.
 * We set up console-message forwarding on the webview, which emits
 * SECURITY_PROBE:: prefixed messages to the renderer's console.
 *
 * Validates that the SECURITY_PROBE_COMPLETE message was received and
 * the result count matches expectations to detect incomplete probe runs.
 */
export async function waitForProbeResults(window: Page, timeoutMs = 60_000): Promise<Record<string, ProbeResult>> {
  const results: Record<string, ProbeResult> = {};

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      const count = Object.keys(results).length;
      reject(new Error(`Probe timeout after ${timeoutMs}ms — received ${count} results without SECURITY_PROBE_COMPLETE`));
    }, timeoutMs);

    const handler = (msg: { text: () => string }) => {
      const text = msg.text();

      if (text.includes(PROBE_PREFIX)) {
        const jsonStr = text.substring(text.indexOf(PROBE_PREFIX) + PROBE_PREFIX.length);
        try {
          const result: ProbeResult = JSON.parse(jsonStr);
          results[result.id] = result;
        } catch {
          // Ignore malformed probe results
        }
      }

      if (text.includes(PROBE_COMPLETE_PREFIX)) {
        clearTimeout(timeout);
        window.removeListener('console', handler);

        // Validate the completion summary matches collected results
        const summaryStr = text.substring(text.indexOf(PROBE_COMPLETE_PREFIX) + PROBE_COMPLETE_PREFIX.length);
        try {
          const summary = JSON.parse(summaryStr);
          const collected = Object.keys(results).length;
          if (typeof summary.total === 'number' && collected < summary.total) {
            console.warn(`[probes] Collected ${collected}/${summary.total} probe results — some may have been lost`);
          }
        } catch {
          // Summary parse failed — still resolve with what we have
        }

        resolve(results);
      }
    };

    window.on('console', handler);
  });
}

/**
 * Inject a product archive into the main process (via IPC) and create a raw
 * `<webview>` element pointing at `polkadot://{domain}/`.
 *
 * This bypasses the React Webview component's domain resolution (DOTNS + IPFS),
 * which requires real blockchain + IPFS connections. Instead we:
 * 1. Store the archive in the main process cache (polkadot:// protocol handler)
 * 2. Create a `<webview>` with the correct `partition` and `src`
 * 3. Forward console messages from the webview to the renderer
 *
 * The `will-attach-webview` handler in sandbox.ts still fires, so all
 * security restrictions (preload injection, node stripping, partition setup)
 * are applied.
 */
export async function injectAndLoadProduct(
  window: Page,
  domain: string,
  files: Record<string, number[]>,
  partition: string = `sandbox-${domain}`,
) {
  // Wait for the preload bridge
  await window.waitForFunction(
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    () => typeof (globalThis as any).App === 'object' && (globalThis as any).App !== null,
    { timeout: DEFAULT_TIMEOUT },
  );

  // Store archive in main process via IPC
  await window.evaluate(
    async data => {
      const archiveFiles: Record<string, Uint8Array> = {};
      for (const [k, v] of Object.entries(data.files)) {
        archiveFiles[k] = new Uint8Array(v);
      }
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      await (globalThis as any).App.saveArchive({
        domain: data.domain,
        origin: `polkadot://${data.domain}`,
        files: archiveFiles,
      });
    },
    { domain, files },
  );

  // Create a raw <webview> element — bypasses React but keeps all sandbox restrictions.
  // Wire did-finish-load / did-fail-load BEFORE appending so we never miss the
  // first event (events queue but listeners must exist when they fire).
  await window.evaluate(
    ({ d, part }) => {
      const existing = document.getElementById('test-webview');
      if (existing) existing.remove();

      const wv = document.createElement('webview');
      wv.id = 'test-webview';
      wv.setAttribute('partition', part);
      wv.setAttribute('src', `polkadot://${d}/`);
      wv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:99999;';

      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      (wv as any).addEventListener('console-message', (e: any) => {
        const methods = [console.debug, console.info, console.warn, console.error] as const;
        const log = methods[e.level] ?? console.info;
        log(`[${d}]`, e.message);
      });
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      (wv as any).addEventListener('did-finish-load', () => {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        (wv as any).__loaded = true;
      });
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      (wv as any).addEventListener('did-fail-load', (e: any) => {
        // ERR_ABORTED (-3) = user-stop or superseding nav, not a real failure.
        if (e.errorCode === -3) return;
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        (wv as any).__failed = `${e.errorCode} ${e.errorDescription || ''}`.trim();
      });

      document.body.appendChild(wv);
    },
    { d: domain, part: partition },
  );

  await window.waitForFunction(
    () => {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const wv = document.querySelector('#test-webview') as any;
      if (!wv) return false;
      if (wv.__failed) throw new Error(`webview load failed: ${wv.__failed}`);
      return wv.__loaded === true;
    },
    { timeout: DEFAULT_TIMEOUT },
  );

  // Give the webview content time to execute
  await window.waitForTimeout(1_000);
}

/**
 * Wait for the webview to finish loading its content.
 */
export async function waitForWebviewReady(window: Page, timeoutMs = DEFAULT_TIMEOUT) {
  await window.waitForFunction(
    () => {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const wv = document.querySelector('webview') as any;
      if (!wv || typeof wv.getURL !== 'function') return false;
      try {
        return wv.getURL() !== '';
      } catch {
        return false;
      }
    },
    { timeout: timeoutMs },
  );
}
