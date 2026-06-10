@chat @allure.label.parentSuite:chat @allure.label.suite:Chat_P2P @allure.label.feature:Chat_P2P
Feature: P2P Chat — contact search (PB-217)

  Username-based contact search against a second signing-bot identity
  attested on paseo-next. The full request + accept + exchange flow lives
  in chat-p2p-pair.feature — two real Electron instances, because the
  signing-bot does not accept incoming chat requests on-chain.

  Background:
    Given the user is authenticated
    And the chat peer bot is ready and listening
    And no chat session exists with the peer bot

  @skip # flaky: peer-bot attestation on paseo-next intermittently 500s (on-chain extrinsic doesn't land)
  Scenario: Contact search finds the peer bot by username
    When the user opens the chat as a tab
    And the user opens the contact search
    And the user types the peer bot's lite username into the contact search
    Then the contact search shows the peer bot as a result
