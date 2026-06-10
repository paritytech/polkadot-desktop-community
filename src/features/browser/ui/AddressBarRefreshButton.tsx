import RotateCwIcon from '@/shared/assets/images/header/rotate-cw.svg?jsx';
import { iconBase } from '@/shared/components';
import { TEST_IDS } from '@/shared/test-ids';
import { cnTw } from '@/shared/utils';
import { type Product } from '@/domains/product';
import { onProductRefreshRequestedSideEffect, useProductRefreshing } from '@/aggregates/product-loading';

const refreshIconClassName = `h-[15px] w-[15px] ${iconBase}`;

type Props = {
  product: Product;
  isFocused: boolean;
};

export const AddressBarRefreshButton = ({ product, isFocused }: Props) => {
  const { isRefreshing } = useProductRefreshing(product.baseName);

  return (
    <button
      data-testid={TEST_IDS.browserRefreshButton}
      className={cnTw(
        '-mr-2 flex size-6 shrink-0 items-center justify-center rounded-full transition-[colors,opacity] duration-200 hover:bg-bg-action-secondary-hover',
        !isFocused ? 'opacity-100' : 'pointer-events-none opacity-0',
      )}
      tabIndex={isFocused ? -1 : 0}
      onMouseDown={e => {
        e.preventDefault();
      }}
      onClick={() => {
        void onProductRefreshRequestedSideEffect.apply({ identifier: product.baseName });
      }}
    >
      <RotateCwIcon className={cnTw(refreshIconClassName, isRefreshing && 'animate-spin')} aria-hidden />
    </button>
  );
};
