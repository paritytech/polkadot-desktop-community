import { createFileRoute } from '@tanstack/react-router';

import { PermissionListPage } from '@/features/permission-settings';

export const Route = createFileRoute('/settings/privacy/permissions/')({
  component: PermissionListPage,
});
