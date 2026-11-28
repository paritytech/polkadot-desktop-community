import { useEffect, useState } from 'react';

import PolkadotIcon from '@/shared/assets/images/polkadot-half-logo.svg?jsx';
import { isElectron } from '@/shared/env';
import { MemoryStickIcon } from '@/shared/icons';
import { useRxState } from '@/shared/rxstate';
import { TEST_IDS } from '@/shared/test-ids';
import { useTranslation } from '@/shared/translation';
import { useDisplayedProduct, useDotNsLabels } from '@/domains/product';
import { webviewRegistry } from '@/aggregates/webview-registry';
import { PinIndicator } from '@/widgets/PinIndicator';
import { ProductIcon } from '@/widgets/ProductIcon';
import { browserService } from '../service';

type Props = { id: string };

export const ProductTabHover = ({ id }: Props) => {
  // Same source as the AddressBar/tab chip: resolve committed-or-live so an
  // uncommitted tab still shows the product's real name, not the bare id.
  const { data: product } = useDisplayedProduct(id);
  const labels = useDotNsLabels();
  // A product without a display name is named by its identifier, as dot.li names it by its domain.
  const name = product?.displayName ? labels.displayName(product.displayName) : id;
  const description = product?.description;

  return (
    <div data-testid={TEST_IDS.tabHoverCard} className="pointer-events-none flex w-64 items-start gap-3 p-4">
      <span className="flex size-8 shrink-0 items-center justify-center">
        <ProductIcon
          icon={product?.icon ?? null}
          className="size-8 rounded-xl object-cover"
          fallback={<PolkadotIcon className="size-7" aria-hidden />}
        />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex min-w-0 flex-col">
          <div className="flex min-w-0 items-center gap-1">
            <span className="truncate text-base font-semibold text-chrome-text">{name}</span>
            <PinIndicator productId={product?.baseName ?? id} />
          </div>
          {name !== id && <span className="text-xs wrap-anywhere text-chrome-muted">{id}</span>}
        </div>
        {description && <p className="line-clamp-4 text-sm wrap-anywhere text-chrome-text">{description}</p>}
        <div className="border-t border-chrome-line" role="separator" />
        <TabRamUsageRow tabId={id} />
      </div>
    </div>
  );
};

const TabRamUsageRow = ({ tabId }: { tabId: string }) => {
  const { t } = useTranslation();
  const memory = useTabMemory(tabId);
  return (
    <span className="flex items-center gap-2" data-testid={TEST_IDS.tabHoverRam}>
      <MemoryStickIcon className="size-4 shrink-0" />
      <span className="text-sm">
        {memory === null
          ? t('feature.browser.ramUsageUnavailable')
          : t('feature.browser.ramUsage', { value: browserService.formatMemory(memory) })}
      </span>
    </span>
  );
};

const useTabMemory = (tabId: string): number | null => {
  const [webContentIds] = useRxState(webviewRegistry.ids$);
  const webContentsId = webContentIds[tabId];
  const [memory, setMemory] = useState<number | null>(null);

  useEffect(() => {
    if (!isElectron() || !webContentsId) {
      setMemory(null);
      return;
    }

    let cancelled = false;
    const fetchMemory = async () => {
      const bytes = await window.App.getWebContentsMemory(webContentsId);
      if (!cancelled) setMemory(bytes);
    };

    void fetchMemory();
    const interval = setInterval(fetchMemory, 2000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [webContentsId]);

  return memory;
};
