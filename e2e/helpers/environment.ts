/**
 * Maps the desktop's Environment id (the `VITE_ENVIRONMENTS` channel key, used as the
 * `network-button-<id>` testid by the onboarding picker) to the signing-bot's `network`
 * HTTP parameter (the signing-bot service NETWORKS config).
 *
 * The catalog's channel keys are `nightly` (display "Paseo Next V2") and `unstable`
 * (display "PreviewNet"); the bot networks they map to are `paseo-next-v2` and `preview`.
 */

export type E2eEnvironmentId = 'nightly' | 'unstable';

const ENV_TO_BOT_NETWORK: Record<E2eEnvironmentId, string> = {
  nightly: 'paseo-next-v2',
  unstable: 'preview',
};

export function envToBotNetwork(envId: E2eEnvironmentId): string {
  return ENV_TO_BOT_NETWORK[envId];
}
