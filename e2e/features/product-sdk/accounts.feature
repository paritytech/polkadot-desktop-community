@product-sdk @allure.label.parentSuite:authenticated @allure.label.suite:host-playground @allure.label.feature:Accounts
Feature: Accounts

  Verify account-related APIs work correctly in a product sandbox
  using the host-playground.dot test product.

  Scenario: Account APIs work correctly in product sandbox
    Given the user is authenticated
    And the test product "host-playground.dot" is opened
    And the user clicks the "Accounts" tab
    When the user runs "Get Product Account"
    Then the result contains "publicKey"
    When the user runs "Product Account Signer"
    Then the result contains "Product account signer created"
    When the user runs "Account Connection Status"
    Then the result contains "status updates"
