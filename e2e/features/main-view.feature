@smoke @allure.label.parentSuite:smoke @allure.label.suite:Main_View @allure.label.feature:Main_View
Feature: Main View

  Scenario: Dashboard displays after skipping onboarding
    Given the app is launched
    When the user skips onboarding
    Then the dashboard is displayed
    And the dashboard screenshot is taken as "dashboard"

  Scenario: Dashboard displays correctly in fullscreen
    Given the app is launched
    And the user skips onboarding
    When the user enters fullscreen mode
    Then the dashboard is displayed in fullscreen
    And the dashboard screenshot is taken as "dashboard-fullscreen"

  Scenario: Open quick chat
    Given the app is launched
    And the user skips onboarding
    When the user opens quick chat
    Then the dashboard screenshot is taken as "quick-chat"

  Scenario: Open user card
    Given the app is launched
    And the user skips onboarding
    When the user opens user card
    Then the dashboard screenshot is taken as "user-card"
