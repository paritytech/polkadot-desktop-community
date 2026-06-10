@smoke @allure.label.parentSuite:smoke @allure.label.suite:Sandbox_Health @allure.label.feature:Sandbox_Health
Feature: Sandbox webview health monitor

  # SKIPPED: requires a locally-served test product mounted through the React Webview
  # widget (not the raw webview injection used in security tests). The UnresponsiveOverlay
  # only renders inside the React <Webview> component, which needs DotNS/IPFS resolution
  # or a localhost:// product URL served via a fixture similar to link-navigation.
  #
  # To make this test fully working:
  #  1. Create e2e/test-products/wedge-product/ — a minimal SPA whose JS can be
  #     told (via postMessage or URL param) to run `while(true){}`.
  #  2. Add a fixture (e.g. e2e/fixtures/wedge-product.ts) that serves that product
  #     on an ephemeral HTTP port, similar to e2e/fixtures/link-tests.ts.
  #  3. Navigate to `localhost:<port>` via the address bar so the React Webview
  #     mounts and the SandboxHealthMonitor attaches to the webContents.
  #  4. Trigger the infinite loop in the product, then assert the overlay appears.
  #  5. Remove the @skip tag.
  @skip
  Scenario: Unresponsive overlay appears when product wedges main thread
    Given the app is launched
    And a wedging product is loaded in a webview tab
    When the product's main thread wedges with an infinite loop
    Then the unresponsive overlay appears within 10 seconds
    And clicking the reload button clears the overlay
