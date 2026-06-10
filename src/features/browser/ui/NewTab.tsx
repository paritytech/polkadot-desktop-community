import { useNavigate } from '@tanstack/react-router';
import { BoxSelect, Check, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import PolkadotWordmark from '@/shared/assets/images/logo.svg?jsx';
import { useTranslation } from '@/shared/translation';
import { cnTw } from '@/shared/utils';
import { type Icon, type Product, dotNsService, useDisplayedProduct, usePersistedProducts } from '@/domains/product';
import { ProductIcon } from '@/widgets/ProductIcon';
import { useRecentSearches } from '../hooks/useRecentSearches';

import { AddressBar } from './AddressBar';

const UNDO_WINDOW_SECONDS = 5;
const PINNED_IDS: readonly string[] = ['host-playground.dot', 'coinflipgame03.dot', 'test-dapp-01.dot'];

export const NewTab = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: allProducts } = usePersistedProducts();
  const { recent, clearRecent, restoreRecent } = useRecentSearches();

  const [clearedSnapshot, setClearedSnapshot] = useState<string[] | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(UNDO_WINDOW_SECONDS);

  useEffect(() => {
    if (!clearedSnapshot) return;

    setSecondsLeft(UNDO_WINDOW_SECONDS);
    const interval = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          setClearedSnapshot(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [clearedSnapshot]);

  const openProduct = (product: Product) => {
    navigate({ to: '/product/$id/{-$route}', params: { id: product.baseName } });
  };

  const handleOpenRecent = (id: string) => {
    navigate({ to: '/product/$id/{-$route}', params: { id, route: '' } });
  };

  const handleClear = () => {
    if (recent.length === 0) return;
    setClearedSnapshot(recent);
    clearRecent();
  };

  const handleUndo = () => {
    if (!clearedSnapshot) return;
    restoreRecent(clearedSnapshot);
    setClearedSnapshot(null);
  };

  const productsByBaseName = useMemo(() => new Map(allProducts.map(p => [p.baseName, p])), [allProducts]);
  const recentProducts = useMemo(() => resolveRecentProducts(recent, productsByBaseName), [recent, productsByBaseName]);

  return (
    <div className="bg-main relative h-full w-full overflow-auto p-2">
      <div className="mx-auto flex min-h-full w-full flex-col items-center rounded-2xl bg-elevated pt-[168px] pb-16">
        <div className="flex w-full max-w-[644px] flex-col items-center gap-10 px-4">
          <div className="flex w-full flex-col items-center gap-6">
            <div className="flex w-full flex-col items-center gap-8">
              <PolkadotWordmark className="h-[67px] w-[280px] text-text-primary" />
              <AddressBar size="md" />
            </div>
            <div className="grid w-full grid-cols-3 gap-4">
              {PINNED_IDS.map(id => (
                <PinnedAppCard key={id} identifier={id} onOpen={openProduct} />
              ))}
            </div>
          </div>
          {recentProducts.length > 0 && (
            <div className="flex w-full flex-col items-start gap-4">
              <div className="flex w-full items-center gap-2">
                <h2 className="flex-1 text-[24px] leading-[32px] font-semibold text-text-primary">
                  {t('feature.browser.recentlyOpened')}
                </h2>
                <button
                  type="button"
                  className="flex items-center gap-1 rounded-xs px-2 py-0.5 text-xs leading-4 font-medium text-fg-link transition-colors hover:text-fg-link-hover"
                  onClick={handleClear}
                >
                  {t('feature.browser.clearRecent')}
                </button>
              </div>
              <div className="grid w-full grid-cols-3 gap-4">
                {recentProducts.map(product => (
                  <RecentCard key={product.baseName} product={product} onOpen={handleOpenRecent} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      {clearedSnapshot && (
        <ClearedToast secondsLeft={secondsLeft} onUndo={handleUndo} onDismiss={() => setClearedSnapshot(null)} />
      )}
    </div>
  );
};

// Resolves a pinned identifier through the same `Product`-emitting hook every
// other consumer uses; nothing here pretends to know the displayName/icon
// before the resolver finishes.
const PinnedAppCard = ({ identifier, onOpen }: { identifier: string; onOpen: (product: Product) => void }) => {
  const { data: product } = useDisplayedProduct(identifier);
  if (!product) return null;
  return <AppCard product={product} onOpen={onOpen} />;
};

type AppCardProps = {
  product: Product;
  onOpen: (product: Product) => void;
};

const AppCard = ({ product, onOpen }: AppCardProps) => {
  const displayName = dotNsService.toDisplayName(product.displayName);

  return (
    <button
      type="button"
      className={cnTw(
        'flex w-full flex-col items-start overflow-hidden rounded-xl border border-general-border bg-elevated select-none',
        'transition-colors hover:bg-foreground/5',
      )}
      onClick={() => onOpen(product)}
    >
      <div className="flex w-full items-center justify-center bg-foreground/5 py-6">
        <IconSlab icon={product.icon} size="large" />
      </div>
      <div className="flex w-full items-center gap-2 p-2">
        <IconSlab icon={product.icon} size="small" />
        <span className="truncate text-sm font-semibold text-text-primary">{displayName}</span>
      </div>
    </button>
  );
};

type RecentCardProps = {
  product: Product;
  onOpen: (id: string) => void;
};

const RecentCard = ({ product, onOpen }: RecentCardProps) => {
  const displayName = dotNsService.toDisplayName(product.displayName);

  return (
    <button
      type="button"
      className={cnTw(
        'flex w-full items-center gap-2 overflow-hidden rounded-lg border border-general-border bg-elevated p-3 select-none',
        'text-left transition-colors hover:bg-foreground/5',
      )}
      onClick={() => onOpen(product.baseName)}
    >
      <div className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-md bg-foreground">
        <ProductIcon
          icon={product.icon}
          className="size-5"
          fallback={<BoxSelect className="size-5 text-background" strokeWidth={1.5} />}
        />
      </div>
      <div className="flex min-w-0 flex-col items-start">
        <span className="w-full truncate text-sm leading-5 font-semibold text-text-primary">{displayName}</span>
        <span className="w-full truncate text-sm leading-[18px] text-text-primary">{product.baseName}</span>
      </div>
    </button>
  );
};

type IconSlabProps = {
  icon: Nullable<Icon>;
  size: 'small' | 'large';
};

const IconSlab = ({ icon, size }: IconSlabProps) => {
  const wrapperSize = size === 'large' ? 'size-16 rounded-xl' : 'size-6 rounded-md';
  const imgSize = size === 'large' ? 'size-10' : 'size-4';

  return (
    <div className={cnTw('flex shrink-0 items-center justify-center overflow-hidden bg-foreground', wrapperSize)}>
      <ProductIcon
        icon={icon}
        className={imgSize}
        fallback={<BoxSelect className={cnTw('text-background', imgSize)} strokeWidth={1.5} />}
      />
    </div>
  );
};

type ClearedToastProps = {
  secondsLeft: number;
  onUndo: VoidFunction;
  onDismiss: VoidFunction;
};

const ClearedToast = ({ secondsLeft, onUndo, onDismiss }: ClearedToastProps) => {
  const { t } = useTranslation();

  return (
    <div
      className={cnTw(
        'fixed top-4 right-4 z-50 flex max-w-80 items-start gap-2 rounded-xl border border-general-border bg-elevated p-3 shadow-lg',
        'duration-200 animate-in fade-in slide-in-from-top-2',
      )}
    >
      <Check className="mt-0.5 size-4 shrink-0 text-fg-success" />
      <div className="flex-1 text-sm leading-5 text-text-primary">{t('feature.browser.recentClearedTitle')}</div>
      <button
        type="button"
        className="rounded-md border border-general-border px-2 py-0.5 text-xs leading-4 font-medium text-text-secondary transition-colors hover:bg-foreground/5"
        onClick={onUndo}
      >
        {t('feature.browser.undoLabel', { seconds: secondsLeft })}
      </button>
      <button
        type="button"
        aria-label={t('common.aria.close')}
        className="rounded-md p-0.5 text-text-secondary transition-colors hover:bg-foreground/5"
        onClick={onDismiss}
      >
        <X className="size-4" />
      </button>
    </div>
  );
};

const resolveRecentProducts = (recentIds: string[], byBaseName: Map<string, Product>): Product[] => {
  return recentIds.map(id => byBaseName.get(id)).filter((p): p is Product => p !== undefined);
};
