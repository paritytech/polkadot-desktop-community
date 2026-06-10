import { test as setup } from '@playwright/test';

import { provisionRoles } from './bot-users.shared';

setup('provision authenticated bot user', async () => {
  await provisionRoles({ singletonRoles: ['authenticated'] });
});
