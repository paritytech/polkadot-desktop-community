import RotateCwIcon from '@/shared/assets/images/header/rotate-cw.svg?jsx';
import { iconBase } from '@/shared/components';
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
    <button
      type="button"
      aria-label={t('common.aria.reload')}
      data-testid={TEST_IDS.browserRefreshButton}
      data-no-app-focus
      className="-me-2 flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors duration-200 hover:bg-chrome-fill focus-visible:outline-2 focus-visible:outline-chrome-focus"
      onMouseDown={e => {
        e.preventDefault();
      }}
      onClick={() => {
        void onProductRefreshRequestedSideEffect.apply({ identifier: product.baseName });
      }}
    >
      <RotateCwIcon className={cnTw(`h-3.75 w-3.75`, iconBase, isRefreshing && 'animate-spin')} aria-hidden />
    </button>
  );
};
