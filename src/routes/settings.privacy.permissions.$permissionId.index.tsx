import { createFileRoute } from '@tanstack/react-router';

import { useTranslation } from '@/shared/translation';
import { PermissionDetailPage } from '@/features/permission-settings';

export const Route = createFileRoute('/settings/privacy/permissions/$permissionId/')({
  component: () => {
    const { t } = useTranslation();
    const { permissionId } = Route.useParams();
    const navigate = Route.useNavigate();

    return (
      <PermissionDetailPage
        permissionId={permissionId}
        backLabel={t('feature.permissionSettings.navItem')}
        onBack={() => navigate({ to: '/settings/privacy/permissions' })}
      />
    );
  },
});
