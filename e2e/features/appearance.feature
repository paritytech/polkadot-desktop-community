@authenticated @allure.label.parentSuite:authenticated @allure.label.suite:Appearance @allure.label.feature:Theme
Feature: Appearance settings

  Scenario: Switch to dark theme via user popover
    Given the user is authenticated
    And the user is on the dashboard
    When the user toggles the theme to dark
    Then the authenticated dashboard screenshot is taken as "dark-theme"
