@chat @allure.label.parentSuite:chat @allure.label.suite:CoinFlip_Chat @allure.label.feature:CoinFlip_Chat
Feature: CoinFlip Chat

  Tests for adding the CoinFlip product widget to the dashboard and
  sending a message to the bot via the QuickChat popover widget.

  Background:
    Given the user is authenticated

  Scenario: User adds CoinFlip widget to dashboard and sends a chat message
    When the user opens "coinflipgame03.dot" in a new tab
    And the user adds the current tab to favorites as a "Large" widget
    And the user navigates to the dashboard
    And the "Coin Flip" chat session appears in the chat widget
    And the user selects the "Coin Flip" chat session in the chat widget
    And the user sends the message "hey"
    Then the message "hey" is visible in the chat
    And the message "Flipping the coin!" is visible in the chat
    And the message "Flip #$1" is visible in the chat
    And a screenshot is taken as "coinflip-chat"
