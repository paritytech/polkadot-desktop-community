@smoke @allure.label.parentSuite:smoke @allure.label.suite:Address_Bar @allure.label.feature:Address_Bar
Feature: Address Bar

  The address bar must gracefully handle input containing special
  characters that do not form a valid dotNS domain. Previously, entering
  such values (e.g. `"localdot.dot`) caused the app to crash.

  Single Electron session is reused — each input is submitted, any tab
  it produced is closed, and the app responsiveness is re-verified.

  Scenario: Entering special characters does not crash the app
    Given the app is launched
    And the user skips onboarding
    Then the address bar survives the following inputs:
      | input                         |
      | "localdot.dot                 |
      | 'localdot.dot                 |
      | "localdot.dot"                |
      | <localdot.dot>                |
      | <script>alert(1)</script>     |
      | {localdot.dot}                |
      | [localdot.dot]                |
      | (localdot.dot)                |
      | `localdot.dot`                |
      | localdot.dot \| ls            |
      | localdot.dot > /tmp/x         |
      | $(localdot.dot)               |
      | localdot.dot && rm -rf /      |
      | localdot.dot; echo hi         |
      | localdot.dot\\n               |
      | '; DROP TABLE products;--     |
      | ../../etc/passwd              |
      | http://user:pass@localdot.dot |
      | localdot.dot?a=1&b=2          |
      | localdot.dot#top              |
      | %%%                           |
      | %20%3Cscript%3E               |
      |   localdot.dot                |
      | \tlocaldot.dot\t              |
      | localdot.dot‏‮                |
      | 🚀localdot.dot🔥              |
      | локалдот.точка                |
      | 本地.测试                     |
      | local​dot.dot                 |
      | null                          |
      | !@#$%^&*()_+={}[]:;"'<>,.?/~` |
      | aaaaaaaaaaaaaaaaaaaaaaaaaaaaa |
