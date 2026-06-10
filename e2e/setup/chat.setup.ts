import { test as setup } from '@playwright/test';

import { CHAT_PAIR_POOL_SIZE, provisionRoles } from './bot-users.shared';

setup('provision chat bot users', async () => {
  await provisionRoles({ singletonRoles: ['chat'], pairCount: CHAT_PAIR_POOL_SIZE });
});
