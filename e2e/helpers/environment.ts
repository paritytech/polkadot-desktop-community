/**
 * Maps the desktop's Environment id to the signing-bot's `network` HTTP parameter.
 * Source of truth: the signing-bot service NETWORKS config.
 * paseo-review isn't yet supported by the bot — falls back to paseo-next-v2.
 */

export type E2eEnvironmentId = 'previewnet' | 'paseo-next-v2' | 'paseo-review';

const ENV_TO_BOT_NETWORK: Record<E2eEnvironmentId, string> = {
  previewnet: 'preview',
  'paseo-next-v2': 'paseo-next-v2',
  'paseo-review': 'paseo-next-v2',
};

export function envToBotNetwork(envId: E2eEnvironmentId): string {
  return ENV_TO_BOT_NETWORK[envId];
}
