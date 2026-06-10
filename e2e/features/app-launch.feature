@smoke @allure.label.parentSuite:smoke @allure.label.suite:App_Launch @allure.label.feature:App_Launch
Feature: App Launch

  Scenario: App launches successfully
    Given the app is launched
    Then the app window is visible
