import { Outlet, createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/settings/privacy/permissions/$permissionId')({
  component: () => <Outlet />,
});
