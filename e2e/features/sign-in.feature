@auth @allure.label.parentSuite:auth @allure.label.suite:Sign_in
Feature: Sign In via Signing Bot

  @allure.label.feature:Sign_in_Previewnet @skip
  Scenario: Sign in on Previewnet environment
    Given the app is launched in autotest mode
    And the user selects the "previewnet" environment
    And the QR code is displayed on onboarding screen
    When the user pairs via signing bot on "previewnet"
    Then the user is redirected to dashboard
    And session data exists in localStorage
    And user info is visible in the top bar

  @allure.label.feature:Log_out
  Scenario: Logout clears session and redirects to onboarding
    Given the app is launched in autotest mode
    And the user is signed in on "paseo-next-v2" via signing bot
    When the user clicks logout
    Then user secrets are removed from localStorage
    And the user is redirected to onboarding screen
