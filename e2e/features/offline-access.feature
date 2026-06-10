@authenticated @allure.label.parentSuite:authenticated @allure.label.suite:Offline_Access @allure.label.feature:Offline_Access
Feature: Offline access — enable

  Scenario: User pins a product for offline use
    Given the user is authenticated
    And the user is on the dashboard
    And the user opens "coinflipgame03.dot" in a new tab
    When the user opens the product actions menu
    And the user selects "Enable offline access"
    And the user confirms the offline access dialog
    Then the pin indicator appears next to the product address
