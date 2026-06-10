import { e2eConfig } from '../config';
import { BotUserSession, generateBotUsername } from '../helpers/bot-user';
import { type E2eEnvironmentId, envToBotNetwork } from '../helpers/environment';

import { type PoolRole, CHAT_PAIR_POOL_SIZE, readPool, writePool } from './bot-user-pool';

/**
 * Environment every bot user in the pool is attested on. Must match the env
 * the fixtures sign in with (`AUTH_ENVIRONMENT_ID` in `authenticated.ts` and
 * `CHAT_PAIR_ENVIRONMENT_ID` in `chatPair.ts`).
 */
const ENVIRONMENT_ID: E2eEnvironmentId = 'paseo-next-v2';
const BOT_NETWORK = envToBotNetwork(ENVIRONMENT_ID);

/**
 * Per-role override env (e.g. `BOT_USERNAME_AUTH`). Pins a specific identity
 * to skip the attestation cost — useful for manual repro.
 */
function envOverride(role: PoolRole): string | undefined {
  const envKey = `BOT_USERNAME_${role.toUpperCase().replace(/-/g, '_')}`;
  return process.env[envKey];
}

async function provisionUser(username: string, botToken: string | undefined): Promise<string> {
  const session = new BotUserSession(username, e2eConfig.botUrl, botToken);
  await session.ensure(BOT_NETWORK);
  return username;
}

/**
 * Provision the given singleton roles and/or chat pairs, then merge into the
 * pool file. Per-project setup projects call this with only what their
 * dependents need, so running `--project=auth` doesn't provision chat pairs.
 *
 * Merging (not overwriting) lets `--project=auth --project=chat` in one
 * Playwright invocation accumulate into the same pool — each setup adds its
 * slice, teardown removes the whole lot at the end.
 *
 * Relies on `globalSetup` having cleared the stale pool file at invocation
 * start, and on `workers: 1` serializing setup tests so concurrent writes
 * can't race.
 */
export async function provisionRoles(opts: { singletonRoles?: PoolRole[]; pairCount?: number }): Promise<void> {
  const botToken = process.env['BOT_TOKEN'];
  const singletonRoles = opts.singletonRoles ?? [];
  const pairCount = opts.pairCount ?? 0;
  const start = Date.now();

  console.info(
    `[SETUP] Provisioning ${singletonRoles.length} singletons (${singletonRoles.join(', ') || '—'}) + ${pairCount} chat pairs on ${BOT_NETWORK}…`,
  );

  const singletonTasks = singletonRoles.map(async role => {
    const username = envOverride(role) ?? generateBotUsername();
    await provisionUser(username, botToken);
    return [role, username] as const;
  });

  const pairTasks = Array.from({ length: pairCount }, async () => {
    const alice = generateBotUsername();
    const bob = generateBotUsername();
    await Promise.all([provisionUser(alice, botToken), provisionUser(bob, botToken)]);
    return { alice, bob };
  });

  const [singletonEntries, newPairs] = await Promise.all([Promise.all(singletonTasks), Promise.all(pairTasks)]);

  const existing = (await readPool()) ?? { network: BOT_NETWORK, users: {}, chatPairs: [] };
  const merged = {
    network: BOT_NETWORK,
    users: { ...existing.users, ...Object.fromEntries(singletonEntries) },
    chatPairs: [...existing.chatPairs, ...newPairs],
  };
  await writePool(merged);

  console.info(
    `[SETUP] Ready in ${Math.round((Date.now() - start) / 1000)}s. Pool now has ${Object.keys(merged.users).length} singletons, ${merged.chatPairs.length} pairs.`,
  );
}

export { CHAT_PAIR_POOL_SIZE };
