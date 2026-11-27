import { useNavigate } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';

import CheckIcon from '@/shared/assets/images/icons/check.svg?jsx';
import SquareDashedIcon from '@/shared/assets/images/icons/square-dashed.svg?jsx';
import XIcon from '@/shared/assets/images/icons/x.svg?jsx';
import PolkadotWordmark from '@/shared/assets/images/logo.svg?jsx';
import { Button, IconButton } from '@/shared/components';
import { TEST_IDS } from '@/shared/test-ids';
import { useTranslation } from '@/shared/translation';
import { cnTw } from '@/shared/utils';
import {
  type Icon,
  type Product,
  clearRecentProducts,
  dotNsService,
  restoreRecentProducts,
  useDisplayedProduct,
  useDotNsLabels,
  useDotNsTld,
  usePersistedProducts,
  useRecentProductIds,
} from '@/domains/product';
import { ProductIcon } from '@/widgets/ProductIcon';

import { AddressBar } from './AddressBar';

const UNDO_WINDOW_SECONDS = 5;
// Bare labels: the dotNS suffix is the network's TLD, appended at render. Safe
// here because these are only rendered and navigated to — never persisted, and
// never compared against a committed row.
const PINNED_LABELS: readonly string[] = ['host-playground', 'coinflipgame03', 'test-dapp-01'];

export const NewTab = () => {
  const { t } = useTranslation();
  const { data: tld } = useDotNsTld();
  const navigate = useNavigate();
  const { data: allProducts } = usePersistedProducts();
  const { data: recent } = useRecentProductIds();

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
    clearRecentProducts();
  };

  const handleUndo = () => {
    if (!clearedSnapshot) return;
    restoreRecentProducts(clearedSnapshot);
    setClearedSnapshot(null);
  };

  const productsByBaseName = useMemo(() => new Map(allProducts.map(p => [p.baseName, p])), [allProducts]);
  const recentProducts = useMemo(() => resolveRecentProducts(recent, productsByBaseName), [recent, productsByBaseName]);

  return (
    <div className="bg-main relative h-full w-full overflow-auto p-2" data-testid={TEST_IDS.newTabPage}>
      <div className="mx-auto flex min-h-full w-full flex-col items-center rounded-2xl bg-bg-surface-container pt-42 pb-16">
        <div className="flex w-full max-w-161 flex-col items-center gap-10 px-4">
          <div className="flex w-full flex-col items-center gap-6">
            <div className="flex w-full flex-col items-center gap-8">
              <span data-testid={TEST_IDS.newTabWordmark}>
                <PolkadotWordmark className="h-16.75 w-70 text-fg-primary" />
              </span>
              <AddressBar size="md" />
            </div>
            <div className="grid w-full grid-cols-3 gap-4">
              {PINNED_LABELS.map(label => (
                <PinnedAppCard key={label} identifier={dotNsService.baseNameOf(label, tld)} onOpen={openProduct} />
              ))}
            </div>
          </div>
          {recentProducts.length > 0 && (
            <div className="flex w-full flex-col items-start gap-4">
              <div className="flex w-full items-center gap-2">
                <h2 className="flex-1 text-2xl font-semibold text-fg-primary">{t('feature.browser.recentlyOpened')}</h2>
                <Button variant="ghost" size="sm" data-testid={TEST_IDS.newTabClearRecents} onClick={handleClear}>
                  {t('feature.browser.clearRecent')}
                </Button>
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
  const labels = useDotNsLabels();
  const displayName = labels.displayName(product.displayName);

  return (
    <button
      type="button"
      data-testid={TEST_IDS.newTabPinnedCard}
      className={cnTw(
        'flex w-full flex-col items-start overflow-hidden rounded-xl border border-stroke-primary bg-bg-surface-container select-none',
        'transition-colors hover:bg-fg-primary/5',
      )}
      onClick={() => onOpen(product)}
    >
      <div className="flex w-full items-center justify-center bg-fg-primary/5 py-6">
        <IconSlab icon={product.icon} size="large" />
      </div>
      <div className="flex w-full items-center gap-2 p-2">
        <IconSlab icon={product.icon} size="small" />
        <span className="truncate text-sm font-semibold text-fg-primary">{displayName}</span>
      </div>
    </button>
  );
};

type RecentCardProps = {
  product: Product;
  onOpen: (id: string) => void;
};

const RecentCard = ({ product, onOpen }: RecentCardProps) => {
  const labels = useDotNsLabels();
  const displayName = labels.displayName(product.displayName);

  return (
    <button
      type="button"
      data-testid={TEST_IDS.newTabRecentCard}
      className={cnTw(
        'flex w-full items-center gap-2 overflow-hidden rounded-lg border border-stroke-primary bg-bg-surface-container p-3 select-none',
        'text-start transition-colors hover:bg-fg-primary/5',
      )}
      onClick={() => onOpen(product.baseName)}
    >
      <div className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-md bg-fg-primary">
        <ProductIcon
          icon={product.icon}
          className="size-5"
          fallback={<SquareDashedIcon className="size-5 text-bg-surface-main" />}
        />
      </div>
      <div className="flex min-w-0 flex-col items-start">
        <span className="w-full truncate text-sm font-semibold text-fg-primary">{displayName}</span>
        <span className="w-full truncate text-sm text-fg-primary">{product.baseName}</span>
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
    <div className={cnTw('flex shrink-0 items-center justify-center overflow-hidden bg-fg-primary', wrapperSize)}>
      <ProductIcon
        icon={icon}
        className={imgSize}
        fallback={<SquareDashedIcon className={cnTw('text-bg-surface-main', imgSize)} />}
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
      data-testid={TEST_IDS.newTabRecentToast}
      className={cnTw(
        'fixed end-4 top-4 z-50 flex max-w-80 items-center gap-2 rounded-xl border border-stroke-primary bg-bg-surface-container p-3 shadow-lg',
        'duration-200 animate-in fade-in slide-in-from-top-2',
      )}
    >
      <CheckIcon className="size-4 shrink-0 text-fg-success" />
      <div className="flex-1 text-sm text-fg-primary">{t('feature.browser.recentClearedTitle')}</div>
      <Button variant="ghost" size="sm" data-testid={TEST_IDS.newTabRecentUndo} onClick={onUndo}>
        {t('feature.browser.undoLabel', { seconds: secondsLeft })}
      </Button>
      <IconButton size="sm" label={t('common.aria.close')} onClick={onDismiss}>
        <XIcon />
      </IconButton>
    </div>
  );
};

const resolveRecentProducts = (recentIds: string[], byBaseName: Map<string, Product>): Product[] => {
  return recentIds.map(id => byBaseName.get(id)).filter((p): p is Product => p !== undefined);
};
