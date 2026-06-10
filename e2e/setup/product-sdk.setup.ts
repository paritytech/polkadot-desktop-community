import { test as setup } from '@playwright/test';

import { provisionRoles } from './bot-users.shared';

setup('provision product-sdk bot user', async () => {
  await provisionRoles({ singletonRoles: ['product-sdk'] });
});
