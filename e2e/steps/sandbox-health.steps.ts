/**
 * Step definitions for sandbox-health.feature.
 *
 * These steps are stubs — the scenario is tagged @skip because it requires
 * a locally-served wedging product mounted through the React <Webview> widget.
 * See the comments in sandbox-health.feature for what needs to be built to make
 * the test fully operational.
 */
import { createBdd } from 'playwright-bdd';

import { test } from '../fixtures/base';

const { Given, When, Then } = createBdd(test);

Given('a wedging product is loaded in a webview tab', async ({ electronApp }) => {
  // TODO: serve e2e/test-products/wedge-product/ on an ephemeral port (like
  // link-navigation fixture), navigate to localhost:<port> via address bar, and
  // wait for the React Webview to finish loading (data-testid="webview-host").
  void electronApp;
  throw new Error('Not implemented — see sandbox-health.feature for prerequisites');
});

When("the product's main thread wedges with an infinite loop", async ({ electronApp }) => {
  // TODO: once the webview is mounted, execute `while(true){}` inside it via
  // evaluateInWebview(). The SandboxHealthMonitor heartbeat will time out and
  // emit WEBVIEW_HEALTH_STATE with state='unresponsive', which the renderer
  // forwards to webviewRegistry.markUnresponsive() — triggering the overlay.
  void electronApp;
  throw new Error('Not implemented — see sandbox-health.feature for prerequisites');
});

Then('the unresponsive overlay appears within {int} seconds', async ({ electronApp }, _timeoutSeconds: number) => {
  // TODO: wait for data-testid="unresponsive-overlay-reload" to become visible
  // within the given timeout. The overlay is rendered by UnresponsiveOverlay.tsx
  // inside the React Webview widget.
  void electronApp;
  throw new Error('Not implemented — see sandbox-health.feature for prerequisites');
});

Then('clicking the reload button clears the overlay', async ({ electronApp }) => {
  // TODO: click data-testid="unresponsive-overlay-reload" and assert that the
  // overlay disappears (webviewRegistry.clearUnresponsive is called on click).
  void electronApp;
  throw new Error('Not implemented — see sandbox-health.feature for prerequisites');
});
