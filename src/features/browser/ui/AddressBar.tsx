import { useLocation, useParams } from '@tanstack/react-router';
import { isString } from 'lodash-es';

import PolkadotIcon from '@/shared/assets/images/polkadot-half-logo.svg?jsx';
import { Slot, useTransformer } from '@/shared/di';
import { useRxState } from '@/shared/rxstate';
import { TEST_IDS } from '@/shared/test-ids';
import { useTranslation } from '@/shared/translation';
import { cnTw } from '@/shared/utils';
import { useDisplayedProduct, useDotNsTld } from '@/domains/product';
import { CHAT, isChatPathname } from '@/aggregates/browser-tabs';
import { productLoading } from '@/aggregates/product-loading';
import { ProductIcon } from '@/widgets/ProductIcon';
import {
  addressBarProductLeadingSlot,
  addressBarProductTrailingSlot,
  focusAddressBarSideEffect,
  resolveAddressBarProductIconTransformer,
} from '../di';
import { browserService } from '../service';

type AddressBarProps = {
  size?: 'sm' | 'md';
};

/**
 * Where you are, and the way in to the input surface.
 *
 * This used to be an editable field with its own suggestions dropdown, keyboard
 * navigation and submit path — all of which the input spotlight now owns. Keeping
 * a second editable surface meant two suggestion stacks and two notions of what a
 * typed string means, so the bar kept the job only it can do (showing the current
 * product, its loading state and its slots) and hands typing to the spotlight.
 */
export const AddressBar = ({ size = 'sm' }: AddressBarProps) => {
  const { t } = useTranslation();
  const { data: tld } = useDotNsTld();
  const params = useParams({ strict: false });
  const { pathname } = useLocation();
  const isProductRoute = pathname.startsWith('/product/');
  const isChatRoute = isChatPathname(pathname);

  const productId = isProductRoute && isString(params.id) ? params.id : isChatRoute ? CHAT : null;
  const resolvedProductId = isProductRoute && isString(params.id) ? params.id : null;
  const rawRoute = isProductRoute && isString(params['route']) ? params['route'] : '';
  const productRoute = rawRoute.startsWith('/') ? rawRoute.slice(1) : rawRoute;
  const fullProductPath = productId && productRoute ? `${productId}/${productRoute}` : (productId ?? '');

  const { name, rest } = browserService.splitDisplayAddress(fullProductPath);

  const [loadingIdentifiers] = useRxState(productLoading.identifiers$);
  const isLoading = resolvedProductId != null && loadingIdentifiers.has(resolvedProductId);

  // Metadata for `/product/:id` routes only — native subjects (e.g. chat) must not
  // resolve a legacy product row for their display id.
  const { data: product } = useDisplayedProduct(resolvedProductId);
  const slotProduct = isProductRoute ? product : null;
  // Native subjects (e.g. chat) have no product row to derive a favicon from;
  // a provider resolves their leading icon by id, else this is null and the
  // generic ProductIcon/Polkadot fallback renders.
  const resolvedProductIcon = useTransformer(resolveAddressBarProductIconTransformer, {
    productId: productId ?? '',
    product: slotProduct,
  });

  // `focusAddressBar` already meant "the user wants to type an address" — Cmd/Ctrl+K,
  // the new-tab flow and this click all raise it. The handler now lives in the
  // input-modality feature, so the contract keeps its four callers and changes
  // meaning in exactly one place.
  // The bar shows where you are, so opening it hands that string over to be
  // edited rather than starting from nothing. Product routes only: a native
  // subject's display id (`chat`) names a surface, not an address, and nothing
  // could be done with it in the field.
  const open = () => {
    void focusAddressBarSideEffect.apply({ initialText: isProductRoute ? fullProductPath : '' });
  };

  return (
    <div className={cnTw('relative w-full', size === 'sm' && 'max-w-150 min-w-80')}>
      {/* The container stays a div and only the label is a button. Both slots
          inject interactive controls — the refresh button and the product actions
          menu — and a button inside a button is invalid HTML that browsers un-nest,
          which would route those clicks to this handler instead. */}
      <div
        className="relative flex h-9 w-full items-center gap-2 overflow-hidden rounded-full bg-chrome-well px-3 shadow-chrome-pill transition-colors hover:bg-chrome-well-strong"
        style={{ appRegion: 'no-drag' }}
      >
        {productId && (
          <span className="flex shrink-0 items-center text-chrome-muted empty:hidden">
            <Slot id={addressBarProductLeadingSlot} props={{ product: slotProduct }} />
          </span>
        )}

        <button
          type="button"
          data-testid={TEST_IDS.addressBarInput}
          aria-label={t('feature.browser.addressPlaceholder', { tld })}
          data-no-app-focus
          className={cnTw(
            'flex h-full min-w-0 flex-1 cursor-pointer items-center justify-center gap-2 truncate rounded-full text-sm focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-chrome-focus',
            productId ? 'text-chrome-text' : 'text-chrome-muted',
          )}
          onClick={open}
        >
          {productId ? (
            <>
              {resolvedProductIcon ?? (
                <ProductIcon
                  icon={slotProduct?.icon}
                  className="size-4 shrink-0"
                  fallback={<PolkadotIcon className="size-4 shrink-0" />}
                />
              )}
              <span className="min-w-0 truncate">
                <span className="font-semibold">{name}</span>
                <span className="text-chrome-muted">{rest}</span>
              </span>
            </>
          ) : (
            t('feature.browser.addressPlaceholder', { tld })
          )}
        </button>

        <span className="flex shrink-0 items-center text-chrome-muted empty:hidden">
          <Slot id={addressBarProductTrailingSlot} props={{ product: slotProduct }} />
        </span>

        {isLoading && (
          <span data-testid={TEST_IDS.addressBarLoadingBar} className="absolute inset-x-0 bottom-0 h-0.5">
            <span className="block h-full w-1/3 animate-[loading-bar_1s_ease-in-out_infinite] bg-chrome-text" />
          </span>
        )}
      </div>
    </div>
  );
};
