import { createFileRoute } from '@tanstack/react-router';

import { AppPermissionEntityPage } from '@/features/product-settings';

const RouteComponent = () => {
  const { permissionId, productId } = Route.useParams();
  const navigate = Route.useNavigate();

  return (
    <AppPermissionEntityPage
      productId={productId}
      permissionId={permissionId}
      onBack={() => navigate({ to: '/settings/privacy/permissions/$permissionId', params: { permissionId } })}
    />
  );
};

export const Route = createFileRoute('/_app/settings/privacy/permissions/$permissionId/$productId')({
  component: RouteComponent,
});
