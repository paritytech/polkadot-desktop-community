import { useLocation, useParams } from '@tanstack/react-router';
import { isString } from 'lodash-es';
import { type FocusEvent, useEffect, useRef, useState } from 'react';

import PolkadotIcon from '@/shared/assets/images/polkadot-half-logo.svg?jsx';
import { Slot, useSideEffect } from '@/shared/di';
import { useRxState } from '@/shared/rxstate';
import { TEST_IDS } from '@/shared/test-ids';
import { useTranslation } from '@/shared/translation';
import { cnTw } from '@/shared/utils';
import { type Product, dotNsService, useDisplayedProduct } from '@/domains/product';
import { productLoading } from '@/aggregates/product-loading';
import { ProductIcon } from '@/widgets/ProductIcon';
import {
  addressBarProductLeadingSlot,
  addressBarProductTrailingSlot,
  focusAddressBarSideEffect,
  openDotNsUrlSideEffect,
} from '../di';
import { useDropdownNavigation } from '../hooks/useDropdownNavigation';
import { useFilteredProducts } from '../hooks/useFilteredProducts';
import { useRecentSearches } from '../hooks/useRecentSearches';
import { recents } from '../state/recents';

import { AddressBarDropdown } from './AddressBarDropdown';
import { computeGhostSuffix } from './computeGhostSuffix';

type AddressBarProps = {
  size?: 'sm' | 'md';
  listenForFocus?: boolean;
};

export const AddressBar = ({ size = 'sm', listenForFocus = false }: AddressBarProps) => {
  const { t } = useTranslation();
  const params = useParams({ strict: false });
  const { pathname } = useLocation();
  const isProductRoute = pathname.startsWith('/product/');
  const isChatRoute = pathname.startsWith('/chat');
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [isNewTabFocus, setIsNewTabFocus] = useState(false);
  const isNewTabRef = useRef(false);

  const ghostSuffix = computeGhostSuffix(query);
  const showGhost = isFocused && query.length > 0 && ghostSuffix.length > 0;

  const productId = isProductRoute && isString(params.id) ? params.id : isChatRoute ? 'chat' : null;
  const rawRoute = isProductRoute && isString(params['route']) ? params['route'] : '';
  const productRoute = rawRoute.startsWith('/') ? rawRoute.slice(1) : rawRoute;
  const fullProductPath = productId && productRoute ? `${productId}/${productRoute}` : (productId ?? '');
  const displayValue = isFocused ? query : (productId ?? '');

  const [loadingIdentifiers] = useRxState(productLoading.identifiers$);
  const isLoading = productId != null && loadingIdentifiers.has(productId);

  const placeholderText = t('feature.browser.addressPlaceholder');

  const placeholder = !productId ? placeholderText : fullProductPath;

  const { recent, addRecent, clearRecent, removeRecent } = useRecentSearches();
  const { recentProducts, installed, results, allItems } = useFilteredProducts(query, recent);
  // Metadata for the current route — committed row if installed, else resolved
  // from chain — supplying the leading icon below.
  const { data: product } = useDisplayedProduct(productId);

  const dismissBar = () => {
    setQuery('');
    setIsFocused(false);
    inputRef.current?.blur();
  };

  const handleSelectProduct = (product: Product) => {
    void openDotNsUrlSideEffect.apply({ identifier: product.baseName, pathname: '' });
    dismissBar();
  };

  const { activeIndex, handleKeyDown: handleNavKeyDown } = useDropdownNavigation({
    items: allItems,
    onSelect: handleSelectProduct,
  });

  const handleFocus = () => {
    // Skip seeding the query if focus is being restored after the window
    // regained focus (e.g. cmd+tab back). The user's in-progress input has
    // already been preserved via handleBlur's window-focus guard.
    if (isFocused) return;

    setIsFocused(true);

    if (isNewTabRef.current) {
      isNewTabRef.current = false;
      setQuery('');
      setIsNewTabFocus(true);
    } else {
      setQuery(fullProductPath);
      setIsNewTabFocus(false);
      requestAnimationFrame(() => inputRef.current?.select());
    }
  };

  const handleBlur = (e: FocusEvent<HTMLInputElement>) => {
    const related = e.relatedTarget;
    if (related instanceof Node && containerRef.current?.contains(related)) return;
    // Window-level blurs (cmd+tab away, app hide, devtools focus) carry a null
    // relatedTarget. document.hasFocus() is racy here in Electron — the page
    // focus state isn't always flipped by the time this fires — so use the
    // null target as the signal and preserve the in-progress query.
    // Intentional dismissals (Escape, outside click, selection) clear state
    // via dismissBar before this runs, so the early return is a no-op there.
    if (related === null) return;
    setIsFocused(false);
    setQuery('');
    setIsNewTabFocus(false);
  };

  const handleSubmit = (value: string) => {
    if (value.length === 0) return;

    try {
      const domain = dotNsService.parseDotNsDomain(value);
      if (domain) {
        recents.recordRecent(domain.identifier);
        void openDotNsUrlSideEffect.apply(domain);
        dismissBar();
      }
    } catch {
      // invalid domain
    }
  };

  const prevLoad = useRef<{ productId: string | null; isLoading: boolean }>({ productId: null, isLoading: false });
  useEffect(() => {
    const wasSameProductLoading = prevLoad.current.productId === productId && prevLoad.current.isLoading;
    prevLoad.current = { productId, isLoading };
    if (wasSameProductLoading && !isLoading && productId) {
      addRecent(productId);
    }
  }, [isLoading, productId, addRecent]);

  useSideEffect(focusAddressBarSideEffect, options => {
    if (!listenForFocus) return;
    if (options?.newTab) isNewTabRef.current = true;
    inputRef.current?.focus();
  });

  const showSuggestions = isFocused && !isNewTabFocus;

  useEffect(() => {
    if (!showSuggestions || listenForFocus) return;

    const handleOutsideMouseDown = (event: MouseEvent) => {
      if (!(event.target instanceof Node)) return;
      if (containerRef.current?.contains(event.target)) return;
      dismissBar();
    };

    document.addEventListener('mousedown', handleOutsideMouseDown);

    return () => document.removeEventListener('mousedown', handleOutsideMouseDown);
  }, [showSuggestions, listenForFocus]);

  return (
    <>
      {showSuggestions && listenForFocus && <div aria-hidden className="fixed inset-0 z-40" onMouseDown={dismissBar} />}
      <div
        ref={containerRef}
        className={cnTw('relative w-full', size === 'sm' && 'max-w-150 min-w-80', showSuggestions && 'z-50')}
      >
        <div
          className={cnTw(
            'relative flex items-center gap-2 overflow-hidden rounded-full border bg-elevated px-3 transition-[border-color,box-shadow] duration-200',
            size === 'md' ? 'h-9' : 'h-8',
            isFocused ? 'border-primary/40 shadow-[0_0_0_2px_rgba(var(--color-primary),0.1)]' : 'border-general-border',
          )}
          style={{ appRegion: 'no-drag' }}
        >
          {productId && <Slot id={addressBarProductLeadingSlot} props={{ product, isFocused }} />}
          <div className={cnTw('shrink-0 overflow-hidden transition-all duration-200', isFocused && !productId ? 'w-4' : 'w-0')}>
            <ProductIcon
              icon={product?.icon}
              className="size-4"
              fallback={<PolkadotIcon className="size-4 text-text-secondary" />}
            />
          </div>
          <div className="relative min-w-0 flex-1">
            <input
              data-address-bar-input
              data-no-app-focus="true"
              data-testid={TEST_IDS.addressBarInput}
              ref={inputRef}
              type="text"
              spellCheck={false}
              autoCorrect="off"
              value={displayValue}
              placeholder={placeholder}
              className={cnTw(
                'h-full w-full min-w-0 bg-transparent py-1.5 text-sm text-text-primary outline-none placeholder:text-text-secondary',
                !productId && !isFocused && 'text-center',
                (isFocused || productId) && 'text-left',
                productId && !isFocused && 'text-transparent',
                showGhost && 'text-transparent caret-text-primary',
              )}
              onChange={e => {
                setQuery(e.target.value);
                if (e.target.value.length > 0) setIsNewTabFocus(false);
              }}
              onKeyDown={e => {
                if (e.key === 'Escape') {
                  e.preventDefault();
                  dismissBar();

                  return;
                }

                if (e.key === 'Tab' && showGhost && activeIndex === -1) {
                  e.preventDefault();
                  setQuery(query + ghostSuffix);

                  return;
                }

                if (isFocused) {
                  handleNavKeyDown(e);
                }

                if (e.key === 'Enter' && activeIndex === -1) {
                  e.preventDefault();
                  const finalValue = showGhost ? query + ghostSuffix : query;
                  if (showGhost) setQuery(finalValue);
                  handleSubmit(finalValue);
                }
              }}
              onFocus={handleFocus}
              onBlur={handleBlur}
            />
            {productId && (
              <span
                className={cnTw(
                  'pointer-events-none absolute inset-0 flex min-w-0 items-center justify-center gap-2 text-sm text-text-primary transition-opacity duration-200',
                  !isFocused ? 'opacity-100' : 'opacity-0',
                )}
              >
                <ProductIcon
                  icon={product?.icon}
                  className="size-4"
                  fallback={<PolkadotIcon className="size-4 text-text-secondary" />}
                />
                <span className="min-w-0 truncate">{productId}</span>
              </span>
            )}
            {showGhost && (
              <span className="pointer-events-none absolute inset-0 flex items-center justify-start text-sm whitespace-pre">
                <span className="text-text-primary">{query}</span>
                <span className="text-text-secondary">{ghostSuffix}</span>
              </span>
            )}
          </div>
          <Slot id={addressBarProductTrailingSlot} props={{ product, isFocused }} />
          {isLoading && (
            <div className="absolute inset-x-0 bottom-0 h-0.5">
              <div className="h-full w-1/3 animate-[loading-bar_1s_ease-in-out_infinite] bg-primary" />
            </div>
          )}
        </div>
        {showSuggestions && (
          <AddressBarDropdown
            query={query}
            activeIndex={activeIndex}
            recentProducts={recentProducts}
            installed={installed}
            results={results}
            onSelect={handleSelectProduct}
            onClearRecent={clearRecent}
            onRemoveRecent={removeRecent}
          />
        )}
      </div>
    </>
  );
};
