import { createFileRoute } from '@tanstack/react-router';

import { ProductSettingsPage } from '@/features/product-settings';

export const Route = createFileRoute('/_app/settings/privacy/apps/$productId/')({
  component: () => {
    const { productId } = Route.useParams();
    const navigate = Route.useNavigate();

    return <ProductSettingsPage productId={productId} onBack={() => navigate({ to: '/settings/privacy/apps' })} />;
  },
});
