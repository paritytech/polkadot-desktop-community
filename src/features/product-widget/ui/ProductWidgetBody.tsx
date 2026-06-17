import { memo, useState } from 'react';

import { WidgetLoadingScreen } from '@/shared/components';
import { useSideEffect } from '@/shared/di';
import { useTranslation } from '@/shared/translation';
import { productService, useDisplayedProduct, useExecutableArchive } from '@/domains/product';
import { onProductRefreshRequestedSideEffect } from '@/aggregates/product-loading';
import { Webview } from '@/widgets/Webview';

type Props = {
  productId: string;
};

// The card body for a product widget — resolves the widget executable's
// archive and mounts a webview against it. The surrounding chrome (topbar,
// menu, actions) lives in `DashboardCardChrome`; this component is only the
// body.
export const ProductWidgetBody = memo(({ productId }: Props) => {
  const { t } = useTranslation();
  const [refreshKey, setRefreshKey] = useState(0);
  const { data: product, pending: productPending } = useDisplayedProduct(productId);
  const { data: content, pending: executablePending } = useExecutableArchive(product ? { product, kind: 'widget' } : null);

  useSideEffect(onProductRefreshRequestedSideEffect, ({ identifier }) => {
    if (productService.refreshTargetIdentifiers(productId, product).has(identifier)) {
      setRefreshKey(prev => prev + 1);
    }
  });

  const pending = productPending || executablePending;

  if (!pending && !content) {
    return (
      <div className="flex h-full w-full items-center justify-center text-sm text-text-secondary">
        {t('feature.dashboard.domainNotFound')}
      </div>
    );
  }

  if (pending || !content) {
    return <WidgetLoadingScreen />;
  }

  return (
    <div className="relative h-full w-full overflow-hidden">
      <Webview
        key={`${productId}-${refreshKey}`}
        identifier={productId}
        kind="widget"
        loader={<WidgetLoadingScreen />}
        visible={true}
      />
    </div>
  );
});
