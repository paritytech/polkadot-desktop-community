import { createFileRoute } from '@tanstack/react-router';

import { useTranslation } from '@/shared/translation';
import { ProductSettingsPage } from '@/features/product-settings';

export const Route = createFileRoute('/settings/privacy/apps/$productId/')({
  component: () => {
    const { t } = useTranslation();
    const { productId } = Route.useParams();
    const navigate = Route.useNavigate();

    return (
      <ProductSettingsPage
        productId={productId}
        backLabel={t('feature.productSettings.title')}
        onBack={() => navigate({ to: '/settings/privacy/apps' })}
      />
    );
  },
});
