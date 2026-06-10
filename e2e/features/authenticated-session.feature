@authenticated @allure.label.parentSuite:authenticated @allure.label.suite:Authenticated_Session @allure.label.feature:Authenticated_Session
Feature: Authenticated Session (Stable)

  These tests run on a shared pre-authenticated session on the Paseo Next network.
  Sign-in happens once per worker, all tests reuse the same session.

  Scenario: User info is visible in authenticated session
    Given the user is authenticated
    Then the authenticated user info is visible in the top bar

  Scenario: Session data persists in authenticated session
    Given the user is authenticated
    Then the authenticated session data exists in localStorage
