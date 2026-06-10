import { X } from 'lucide-react';
import { type KeyboardEvent, type MouseEvent, useEffect, useRef } from 'react';

import PolkadotIcon from '@/shared/assets/images/polkadot-half-logo.svg?jsx';
import { useTranslation } from '@/shared/translation';
import { cnTw } from '@/shared/utils';
import { type Product, dotNsService } from '@/domains/product';
import { ProductIcon } from '@/widgets/ProductIcon';

import { RecentsList } from './RecentsList';

type AddressBarDropdownProps = {
  query: string;
  activeIndex: number;
  recentProducts: Product[];
  installed: Product[];
  results: Product[];
  onSelect: (product: Product) => void;
  onClearRecent: VoidFunction;
  onRemoveRecent?: (productId: string) => void;
};

const preventBlur = (e: MouseEvent) => e.preventDefault();

const HighlightMatch = ({ text, query }: { text: string; query: string }) => {
  if (!query) return text;

  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;

  return (
    <>
      {text.slice(0, idx)}
      <span className="font-semibold text-text-primary">{text.slice(idx, idx + query.length)}</span>
      {text.slice(idx + query.length)}
    </>
  );
};

const ProductItem = ({
  product,
  isActive,
  query,
  itemRef,
  onSelect,
  onRemove,
}: {
  product: Product;
  isActive: boolean;
  query: string;
  itemRef?: (el: HTMLDivElement | null) => void;
  onSelect: (product: Product) => void;
  onRemove?: (productId: string) => void;
}) => {
  const { t } = useTranslation();
  const displayName = dotNsService.toDisplayName(product.displayName);

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect(product);
    }
  };

  const handleRemove = (e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onRemove?.(product.baseName);
  };

  return (
    <div
      ref={itemRef}
      role="option"
      aria-selected={isActive}
      tabIndex={-1}
      className={cnTw(
        'group flex h-9 w-full cursor-pointer items-center gap-1.5 rounded-lg p-2 text-sm transition-colors',
        isActive ? 'bg-bg-selection-container-hover' : 'hover:bg-bg-selection-container-hover',
      )}
      onMouseDown={preventBlur}
      onClick={() => onSelect(product)}
      onKeyDown={handleKeyDown}
    >
      <div className="flex size-5 shrink-0 items-center justify-center overflow-hidden rounded">
        <ProductIcon
          icon={product.icon}
          className="size-5 rounded"
          fallback={<PolkadotIcon className="size-5 text-text-secondary" />}
        />
      </div>
      <span className="shrink-0 font-medium text-text-primary">
        <HighlightMatch text={displayName} query={query} />
      </span>
      <span aria-hidden className="shrink-0 font-medium text-text-primary">
        {t('feature.browser.suggestionSeparator')}
      </span>
      <span className="min-w-0 flex-1 truncate font-medium text-text-secondary">
        <HighlightMatch text={product.baseName} query={query} />
      </span>
      {onRemove && (
        <button
          type="button"
          aria-label={t('common.aria.close')}
          tabIndex={-1}
          className={cnTw(
            'flex size-6 shrink-0 items-center justify-center rounded-full text-text-secondary transition-[opacity,color,background-color] hover:bg-foreground/10 hover:text-text-primary',
            isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
          )}
          onMouseDown={preventBlur}
          onClick={handleRemove}
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );
};

export const AddressBarDropdown = ({
  query,
  activeIndex,
  recentProducts,
  installed,
  results,
  onSelect,
  onClearRecent,
  onRemoveRecent,
}: AddressBarDropdownProps) => {
  const { t } = useTranslation();
  const activeRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const hasContent = recentProducts.length > 0 || installed.length > 0 || results.length > 0;

  if (!hasContent) {
    if (!query) return null;

    return (
      <div className="absolute top-full right-0 left-0 z-50 mt-1.5 rounded-lg border border-general-border bg-elevated shadow-[0_4px_8px_-2px_rgba(0,0,0,0.16)] animate-in fade-in slide-in-from-top-1">
        <div className="px-4 py-6 text-center text-sm text-text-secondary">{t('feature.browser.addressNoResults')}</div>
      </div>
    );
  }

  let flatIndex = 0;
  const refForIndex = (i: number) => (activeIndex === i ? (el: HTMLDivElement | null) => (activeRef.current = el) : undefined);

  const hasRecent = recentProducts.length > 0;
  const hasInstalled = installed.length > 0;
  const hasResults = results.length > 0;

  const Divider = () => <div className="border-t border-general-border/60" />;

  return (
    <div
      role="listbox"
      className="absolute top-full right-0 left-0 z-50 mt-1.5 flex max-h-[400px] flex-col gap-1 overflow-y-auto overscroll-contain rounded-lg border border-general-border bg-elevated p-1 shadow-[0_4px_8px_-2px_rgba(0,0,0,0.16)] animate-in fade-in slide-in-from-top-1"
    >
      {hasRecent && (
        <div className="flex flex-col gap-1">
          <div className="flex h-6 items-center gap-2 pl-2">
            <span className="flex-1 text-xs leading-4 font-medium text-text-secondary">
              {t('feature.browser.recentlyVisited')}
            </span>
            <button
              type="button"
              className="rounded-xs px-2 py-0.5 text-xs leading-4 font-medium text-fg-link transition-colors hover:text-fg-link-hover"
              onMouseDown={preventBlur}
              onClick={onClearRecent}
            >
              {t('feature.browser.clearRecent')}
            </button>
          </div>
          {recentProducts.map(product => {
            const i = flatIndex++;

            return (
              <ProductItem
                key={product.baseName}
                product={product}
                isActive={activeIndex === i}
                query={query}
                itemRef={refForIndex(i)}
                onSelect={onSelect}
                onRemove={onRemoveRecent}
              />
            );
          })}
        </div>
      )}

      {hasInstalled && (
        <>
          {hasRecent && <Divider />}
          <div className="flex flex-col gap-1">
            <div className="flex h-6 items-center pl-2">
              <span className="text-xs leading-4 font-medium text-text-secondary">{t('feature.browser.addressFavorites')}</span>
            </div>
            {installed.map(product => {
              const i = flatIndex++;

              return (
                <ProductItem
                  key={product.baseName}
                  product={product}
                  isActive={activeIndex === i}
                  query={query}
                  itemRef={refForIndex(i)}
                  onSelect={onSelect}
                />
              );
            })}
          </div>
        </>
      )}

      {hasResults && (
        <>
          {(hasRecent || hasInstalled) && <Divider />}
          <div className="flex flex-col gap-1">
            {results.map(product => {
              const i = flatIndex++;

              return (
                <ProductItem
                  key={product.baseName}
                  product={product}
                  isActive={activeIndex === i}
                  query={query}
                  itemRef={refForIndex(i)}
                  onSelect={onSelect}
                />
              );
            })}
          </div>
        </>
      )}
      {!query && (
        <>
          {(hasRecent || hasInstalled || hasResults) && <Divider />}
          <RecentsList />
        </>
      )}
    </div>
  );
};
