import { createFileRoute } from '@tanstack/react-router';

import { AppPermissionEntityPage } from '@/features/product-settings';

export const Route = createFileRoute('/_app/settings/privacy/apps/$productId/$permissionId')({
  component: () => {
    const { productId, permissionId } = Route.useParams();
    const navigate = Route.useNavigate();

    return (
      <AppPermissionEntityPage
        productId={productId}
        permissionId={permissionId}
        onBack={() => navigate({ to: '/settings/privacy/apps/$productId', params: { productId } })}
      />
    );
  },
});
