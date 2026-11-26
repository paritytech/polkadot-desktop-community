import { createFileRoute } from '@tanstack/react-router';

import { PermissionDetailPage } from '@/features/permission-settings';

export const Route = createFileRoute('/_app/settings/privacy/permissions/$permissionId/')({
  component: () => {
    const { permissionId } = Route.useParams();
    const navigate = Route.useNavigate();

    return <PermissionDetailPage permissionId={permissionId} onBack={() => navigate({ to: '/settings/privacy/permissions' })} />;
  },
});
