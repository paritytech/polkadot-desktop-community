@auth @allure.label.parentSuite:auth @allure.label.suite:Session_Identity
Feature: Session & Connection State

  These auth-project scenarios run a fresh Electron in autotest mode but do NOT
  pair (no signer needed). They cover the user button before sign-in.

  TC-2.5.1 (14703) and TC-2.5.2 (14704) covered the boot-time storage migrations in
  `src/domains/application/papp-provider/service.ts`. That file was removed with the
  host-papp adapter, and neither migration flag exists in `src` any more, so the
  scenarios asserted behaviour the app no longer has.

  @allure.label.feature:Connection_State @allure.id:14702
  Scenario: TC-2.4.3 No-connection state shown before sign-in
    Given the app is launched in autotest mode
    When the user skips onboarding
    Then the user button offers to connect an account
