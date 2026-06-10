@smoke @allure.label.parentSuite:smoke @allure.label.suite:Onboarding @allure.label.feature:Onboarding
Feature: Onboarding QR Code

  Scenario: QR code renders on onboarding screen
    Given the app is launched
    Then the QR code is visible on onboarding screen
    And the QR code width is at least 280
    And the QR code height is at least 280
