import { test as teardown } from '@playwright/test';

import { e2eConfig } from '../config';
import { deleteBotUser } from '../helpers/bot-user';

import { readPool, removePool } from './bot-user-pool';

teardown('cleanup bot users', async () => {
  const pool = await readPool();
  if (!pool) {
    console.info('[TEARDOWN] No pool file — nothing to clean up');
    return;
  }

  const botToken = process.env['BOT_TOKEN'];
  const allUsernames = [...Object.values(pool.users), ...pool.chatPairs.flatMap(pair => [pair.alice, pair.bob])];

  console.info(`[TEARDOWN] Deleting ${allUsernames.length} bot users in parallel from ${pool.network}…`);

  await Promise.all(
    allUsernames.map(username => deleteBotUser({ username, network: pool.network, botUrl: e2eConfig.botUrl, botToken })),
  );

  await removePool();
});
