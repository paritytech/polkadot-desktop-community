@browser @allure.label.parentSuite:browser @allure.label.suite:Appearance @allure.label.feature:Theme
Feature: Appearance settings

  The appearance redesign (PR #744) split appearance into two controls on
  Settings -> Appearance: a "Color mode" segmented control (Device / Day /
  Night, formerly System / Light / Dark) and a "Theme" picker with palette
  cards (Berlin / Tokyo / Lisbon / Malta), plus a chat-mock theme preview.
  Theme settings are reachable without a session, so this runs in the no-auth
  browser project. Module 10.2 covers the color mode control under the
  authenticated project (TestOps cases 14900-14902).

  Background:
    Given the app is launched
    And the user skips onboarding

  @allure.id:14775
  Scenario: TC-4.9.1 Switch color mode between Device, Day and Night
    When the user opens the browser appearance settings
    Then the browser color mode options Device, Day and Night are available
    When the user selects the "Day" browser color mode
    Then the "Day" browser color mode is selected
    When the user selects the "Night" browser color mode
    Then the "Night" browser color mode is selected
    When the user selects the "Device" browser color mode
    Then the "Device" browser color mode is selected

  # Extra coverage beyond TestOps plan 900 (no matching case yet) — asserts the
  # rendered appearance, not just the pressed state of the color mode button.
  Scenario: Night color mode applies dark appearance to the app
    When the user opens the browser appearance settings
    And the user selects the "Night" browser color mode
    Then the app renders in dark appearance
    When the user selects the "Day" browser color mode
    Then the app renders in light appearance

  # Extra coverage beyond TestOps plan 900 (no matching case yet).
  Scenario: Theme picker exposes Berlin, Tokyo, Lisbon and Malta cards
    When the user opens the browser appearance settings
    Then the browser theme options Berlin, Tokyo, Lisbon and Malta are available
    And the "Berlin" browser theme is selected

  # Extra coverage beyond TestOps plan 900 (no matching case yet). The palette
  # assertion checks the theme's CSS variables actually changed on <html>.
  Scenario: Switching the theme applies its palette and is selected
    When the user opens the browser appearance settings
    And the user selects the "Tokyo" browser theme
    Then the "Tokyo" browser theme is selected
    And the applied theme palette is updated
    When the user selects the "Berlin" browser theme
    Then the "Berlin" browser theme is selected

  # Extra coverage beyond TestOps plan 900 (no matching case yet).
  Scenario: Theme preview is displayed on the appearance page
    When the user opens the browser appearance settings
    Then the theme preview is displayed

  # Extra coverage beyond TestOps plan 900 (no matching case yet). Color mode
  # and theme both persist in localStorage and survive a reload. The reload
  # keeps the hash route, so the app comes back on the appearance page.
  Scenario: Appearance choices persist across app reload
    When the user opens the browser appearance settings
    And the user selects the "Night" browser color mode
    And the user selects the "Tokyo" browser theme
    And the app reloads back to the appearance settings
    Then the "Night" browser color mode is selected
    And the "Tokyo" browser theme is selected
    And the app renders in dark appearance
