@product-sdk @allure.label.parentSuite:authenticated @allure.label.suite:host-playground @allure.label.feature:Signing
Feature: Signing

  Verify signing APIs work correctly in a product sandbox
  using the host-playground.dot test product.

  @skip
  Scenario: Sign raw message works correctly in product sandbox
    Given the user is authenticated
    And the test product "host-playground.dot" is opened
    And the user clicks the "Signing" tab
    When the user runs "Sign Raw Message"
    And the user confirms signing
    Then the result contains "Message signed"

  @skip
  Scenario: Sign raw message works after product reload
    Given the user is authenticated
    And the test product "host-playground.dot" is opened
    And the user clicks the "Signing" tab
    When the user runs "Sign Raw Message"
    And the user confirms signing
    Then the result contains "Message signed"
    When the user reloads the product
    And the user clicks the "Signing" tab
    And the user runs "Sign Raw Message"
    And the user confirms signing
    Then the result contains "Message signed"
