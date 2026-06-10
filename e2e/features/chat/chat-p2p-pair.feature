@chat @allure.label.parentSuite:chat @allure.label.suite:Chat_P2P_Pair @allure.label.feature:Chat_P2P_Pair
Feature: P2P Chat between two Electron clients (PB-217)

  Two real Electron instances (Alice and Bob), each signed in with a
  distinct bot identity, chat peer-to-peer via the statement store.
  Each scenario resets local chat state before running so there is no
  cross-test coupling.

  Background:
    Given Alice and Bob are both authenticated
    And no chat session exists between Alice and Bob

  Scenario: Alice sends a chat request by username, Bob accepts
    When Alice opens the chat as a tab
    And Alice opens the contact search
    And Alice types Bob's username into the contact search
    And Alice selects Bob from the search results
    And Alice types "hey Bob" into the welcome message field
    And Alice clicks "Send Request"
    When Bob opens the chat as a tab
    And Bob opens the new requests list
    And Bob accepts the incoming request
    Then a chat session with Alice appears in Bob's chat sidebar

  @skip # skip until finalize chat feature
  Scenario: Alice and Bob exchange messages and reactions
    # Establish the session from scratch.
    When Alice opens the chat as a tab
    And Alice opens the contact search
    And Alice types Bob's username into the contact search
    And Alice selects Bob from the search results
    And Alice types "let's chat" into the welcome message field
    And Alice clicks "Send Request"
    And Bob opens the chat as a tab
    And Bob opens the new requests list
    And Bob accepts the incoming request
    And a chat session with Alice appears in Bob's chat sidebar
    And Bob selects the chat session with Alice
    # Bob's first outgoing message is what promotes Alice's "Waiting…" outgoing
    # request into an actual session on her side — accept signal alone doesn't
    # consistently do it (known app bug).
    And Bob sends the message "hello from Bob"
    And Alice selects the chat session with Bob
    Then the message "hello from Bob" is visible in Alice's chat
    When Alice sends the message "hi Bob"
    Then the message "hi Bob" is visible in Bob's chat
    # Reactions — Alice reacts to Bob's message; both sides should see the pill.
    When Alice reacts with "👍" to the message "hello from Bob"
    Then the reaction "👍" is visible in Alice's chat
    And the reaction "👍" is visible in Bob's chat
