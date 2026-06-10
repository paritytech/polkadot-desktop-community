import { createFileRoute } from '@tanstack/react-router';

import { useTranslation } from '@/shared/translation';
import { usePersistedProductById } from '@/domains/product';
import { AppPermissionEntityPage } from '@/features/product-settings';

export const Route = createFileRoute('/settings/privacy/apps/$productId/$permissionId')({
  component: () => {
    const { t } = useTranslation();
    const { productId, permissionId } = Route.useParams();
    const navigate = Route.useNavigate();
    const { data: product } = usePersistedProductById(productId);
    const backLabel = product?.displayName ?? t('feature.productSettings.title');

    return (
      <AppPermissionEntityPage
        productId={productId}
        permissionId={permissionId}
        backLabel={backLabel}
        onBack={() => navigate({ to: '/settings/privacy/apps/$productId', params: { productId } })}
      />
    );
  },
});
