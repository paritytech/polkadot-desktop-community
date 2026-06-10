@smoke @allure.label.parentSuite:smoke @allure.label.suite:Link_Navigation @allure.label.feature:Link_Navigation
Feature: Link Navigation

  Verifies that the host router stays in sync with in-product navigation
  for visible tabs and — crucially — does NOT get hijacked by navigation
  events fired from a backgrounded tab's webview.

  The product under test is a local HTML fixture served over HTTP and
  loaded via the `localhost:<port>` identifier (bypasses DotNS/IPFS).

  Background:
    Given the app is launched
    And the user skips onboarding
    And the link-tests product is open in a tab

  Scenario: Client-side pushState on a visible tab updates the host route
    When the link-tests product dispatches a pushState to "/push-target"
    Then the host route pathname ends with "/push-target"

  Scenario: Same-product anchor click on a visible tab updates the host route
    When the user clicks the link-tests button "anchor-link"
    Then the host route pathname ends with "/anchor-target"

  Scenario: Backgrounded tab's pushState does not hijack the host route
    When the user navigates to the dashboard
    Then the host is on the dashboard
    When the link-tests product fires a pushState to "/delayed-boot-target" while backgrounded
    Then the host stays on the dashboard for 1000ms
    And the backgrounded webview pathname ends with "/delayed-boot-target"

  Scenario: Returning to the backgrounded tab preserves its SPA state
    When the user dispatches a pushState in the link-tests product to "/bg-target"
    And the user navigates to the dashboard
    And the user schedules a delayed pushState in the link-tests product
    And the user waits for the delayed pushState to fire
    And the user returns to the link-tests tab
    Then the webview pathname ends with "/delayed-boot-target"

  Scenario: Cross-product polkadot:// link does not replace the source tab's content
    When the user clicks the link-tests button "cross-product-link"
    And the user waits for navigation to settle
    And the user returns to the link-tests tab
    Then the webview pathname ends with "/link-tests"

  Scenario: Re-opening a backgrounded product's root via the address bar does not freeze the browser
    When the user dispatches a pushState in the link-tests product to "/push-target"
    And the user navigates to the dashboard
    And the user types the link-tests identifier into the address bar
    Then the host route pathname settles at the link-tests product root
