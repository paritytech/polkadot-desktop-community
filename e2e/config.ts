/**
 * E2E test configuration.
 * Single source of truth for environment-specific values.
 * Override via environment variables in CI or locally.
 *
 * Note: `botUsername` is computed per Playwright project via `makeBotUsername`
 * (see `e2e/helpers/bot-user.ts`) and injected through each project's `use:`
 * block in `playwright.config.ts`. Steps / fixtures must read it from there,
 * not from this file.
 */
export const e2eConfig = {
  // Base URL of the signing-bot service. Required for auth/authenticated/chat/product-sdk
  // projects; smoke/security/link-navigation run without it.
  botUrl: process.env['BOT_URL'] || '',
} as const;
