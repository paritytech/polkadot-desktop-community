@authenticated @allure.label.parentSuite:authenticated @allure.label.suite:Tab_Switching @allure.label.feature:Tab_Switching
Feature: Tab switching stability (Stable)

  Verify that switching between multiple product tabs does not produce
  gray empty pages. Regression test for handler cleanup in ProductContainerBinding
  (missing cleanup caused listener accumulation and blank content on re-mount).

  Uses the shared Paseo Next network authenticated session.

  Background:
    Given the user is authenticated
    And the user is on the dashboard
    And no product tabs are open

  Scenario: All tabs render content after cycling through them
    When the user opens products in new tabs:
      | product                |
      | coinflipgame03.dot     |
      | dotns-search.dot       |
      | host-playground.dot    |
      | browse.dot             |
      | web3summit.dot         |
      | web3summit-admin.dot   |
      | playgroundtest.dot     |
    And the user cycles through all tabs
    Then every tab has loaded content
