import { createFileRoute } from '@tanstack/react-router';

import { useTranslation } from '@/shared/translation';
import { AppPermissionEntityPage } from '@/features/product-settings';
import { getPermissionMeta } from '@/widgets/Permission';

const RouteComponent = () => {
  const { t } = useTranslation();
  const { permissionId, productId } = Route.useParams();
  const navigate = Route.useNavigate();
  const meta = getPermissionMeta(permissionId);
  const backLabel = meta ? t(meta.labelKey) : t('feature.permissionSettings.navItem');

  return (
    <AppPermissionEntityPage
      productId={productId}
      permissionId={permissionId}
      backLabel={backLabel}
      onBack={() => navigate({ to: '/settings/privacy/permissions/$permissionId', params: { permissionId } })}
    />
  );
};

export const Route = createFileRoute('/settings/privacy/permissions/$permissionId/$productId')({
  component: RouteComponent,
});
