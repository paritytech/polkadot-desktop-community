import { test as setup } from '@playwright/test';

import { provisionRoles } from './bot-users.shared';

setup('provision auth bot user', async () => {
  await provisionRoles({ singletonRoles: ['auth'] });
});
