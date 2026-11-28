import { IconButton } from '@/shared/components';
import { RotateCwIcon } from '@/shared/icons';
import { TEST_IDS } from '@/shared/test-ids';
import { useTranslation } from '@/shared/translation';
import { cnTw } from '@/shared/utils';
import { type Product } from '@/domains/product';
import { onProductRefreshRequestedSideEffect, useProductRefreshing } from '@/aggregates/product-loading';

type Props = {
  product: Product;
};

export const AddressBarRefreshButton = ({ product }: Props) => {
  const { t } = useTranslation();
  const { isRefreshing } = useProductRefreshing(product.baseName);

  return (
    <span className="-me-2 flex">
      <IconButton
        size="sm"
        label={t('common.aria.reload')}
        data-testid={TEST_IDS.browserRefreshButton}
        onMouseDown={e => {
          e.preventDefault();
        }}
        onClick={() => {
          void onProductRefreshRequestedSideEffect.apply({ identifier: product.baseName });
        }}
      >
        <RotateCwIcon className={cnTw('size-3.75', isRefreshing && 'animate-spin')} />
      </IconButton>
    </span>
  );
};
