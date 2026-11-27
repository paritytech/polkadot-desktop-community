import { type KeyboardEvent, type MouseEvent, type ReactNode, useEffect, useRef } from 'react';

import XIcon from '@/shared/assets/images/icons/x.svg?jsx';
import PolkadotIcon from '@/shared/assets/images/polkadot-half-logo.svg?jsx';
import { Button, IconButton } from '@/shared/components';
import { TEST_IDS } from '@/shared/test-ids';
import { useTranslation } from '@/shared/translation';
import { cnTw } from '@/shared/utils';
import { type Product, useDotNsLabels } from '@/domains/product';
import { ProductIcon } from '@/widgets/ProductIcon';
import { staggerDelay } from '../constants';

type SuggestionListProps = {
  query: string;
  activeIndex: number;
  recentProducts: Product[];
  installed: Product[];
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
      <span className="font-semibold text-fg-primary">{text.slice(idx, idx + query.length)}</span>
      {text.slice(idx + query.length)}
    </>
  );
};

export const ProductItem = ({
  product,
  isActive,
  index,
  query,
  itemRef,
  onSelect,
  onRemove,
}: {
  product: Product;
  isActive: boolean;
  index: number;
  query: string;
  itemRef?: (el: HTMLDivElement | null) => void;
  onSelect: (product: Product) => void;
  onRemove?: (productId: string) => void;
}) => {
  const { t } = useTranslation();
  const labels = useDotNsLabels();
  const displayName = labels.displayName(product.displayName);

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
      style={{ animationDelay: staggerDelay(index) }}
      className={cnTw(
        'animate-spotlight-row-in group flex h-control w-full cursor-pointer items-center gap-1.5 rounded-2xl px-2 text-sm transition-[background-color,transform] active:scale-[0.99]',
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
          fallback={<PolkadotIcon className="size-5 text-fg-secondary" />}
        />
      </div>
      <span className="shrink-0 font-medium text-fg-primary">
        <HighlightMatch text={displayName} query={query} />
      </span>
      <span aria-hidden className="shrink-0 font-medium text-fg-primary">
        {t('feature.inputModality.suggestionSeparator')}
      </span>
      <span className="min-w-0 flex-1 truncate font-medium text-fg-secondary">
        <HighlightMatch text={product.baseName} query={query} />
      </span>
      {onRemove && (
        <span
          className={cnTw(
            'flex shrink-0 transition-opacity motion-reduce:transition-none',
            isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
          )}
        >
          <IconButton size="sm" label={t('common.aria.close')} tabIndex={-1} onMouseDown={preventBlur} onClick={handleRemove}>
            <XIcon />
          </IconButton>
        </span>
      )}
    </div>
  );
};

export const SectionHeader = ({ label, action }: { label: string; action?: ReactNode }) => (
  <div className="flex h-6 items-center gap-2 ps-2">
    <span className="flex-1 text-xs font-medium text-fg-secondary">{label}</span>
    {action}
  </div>
);

/**
 * The host's own suggestions — where the user has been and what they have saved.
 *
 * These sit above the product candidates because naming a product you already
 * have is a higher-confidence intent than a speculative answer to a string. The
 * flat `activeIndex` runs across every row here so one arrow-key model covers the
 * whole list.
 */
export const SuggestionList = ({
  query,
  activeIndex,
  recentProducts,
  installed,
  onSelect,
  onClearRecent,
  onRemoveRecent,
}: SuggestionListProps) => {
  const { t } = useTranslation();
  const activeRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  if (recentProducts.length === 0 && installed.length === 0) return null;

  let flatIndex = 0;
  const refForIndex = (i: number) => (activeIndex === i ? (el: HTMLDivElement | null) => (activeRef.current = el) : undefined);

  const renderItem = (product: Product, onRemove?: (productId: string) => void) => {
    const i = flatIndex++;

    return (
      <ProductItem
        key={product.baseName}
        product={product}
        index={i}
        isActive={activeIndex === i}
        query={query}
        itemRef={refForIndex(i)}
        onSelect={onSelect}
        onRemove={onRemove}
      />
    );
  };

  return (
    <div role="listbox" data-testid={TEST_IDS.inputModalitySuggestions} className="flex flex-col gap-1">
      {recentProducts.length > 0 && (
        <div data-testid={TEST_IDS.inputModalityRecentsSection} className="flex flex-col gap-1">
          <SectionHeader
            label={t('feature.inputModality.recentlyVisited')}
            action={
              <Button variant="ghost" size="sm" onMouseDown={preventBlur} onClick={onClearRecent}>
                {t('feature.inputModality.clearRecent')}
              </Button>
            }
          />
          {recentProducts.map(product => renderItem(product, onRemoveRecent))}
        </div>
      )}

      {installed.length > 0 && (
        <div data-testid={TEST_IDS.inputModalitySavedSection} className="flex flex-col gap-1">
          <SectionHeader label={t('feature.inputModality.addressFavorites')} />
          {installed.map(product => renderItem(product))}
        </div>
      )}
    </div>
  );
};
