import { Dialog, Input } from '@novasamatech/tr-ui';
import { Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { usePipeline } from '@/shared/di';
import { useTranslation } from '@/shared/translation';
import { cnTw } from '@/shared/utils';
import { type DashboardCard, dashboardLayoutService } from '@/domains/application';
import { type AppListing, browseService, usePublishedWidgetListings } from '@/domains/product';
import { type Product, useDisplayedProduct, useProductIcon } from '@/domains/product';
import { type AddableDashboardCard, addableDashboardCardsPipeline } from '../di';

import { AddWidgetModalNativePanel } from './add-widget/AddWidgetModalNativePanel';
import { AddWidgetModalProductPanel } from './add-widget/AddWidgetModalProductPanel';
import { AddWidgetSidebarCatalogLoading } from './add-widget/AddWidgetSidebarCatalogLoading';
import { AddWidgetSidebarIcon } from './add-widget/AddWidgetSidebarIcon';
import {
  buildNativeSidebarEntries,
  buildPublishedSidebarEntries,
  filterSidebarEntries,
  mergeAddWidgetSidebarEntries,
} from './add-widget/addWidgetList';
import { type AddWidgetSidebarEntry } from './add-widget/types';

type AddWidgetModalDbProps = {
  dashboardPages: DashboardCard[][];
  favoriteProductIds: ReadonlySet<string>;
  isOpen: boolean;
  onClose: () => void;
  onNavigateToDashboardPage: (pageIndex: number) => void;
  onSelectProduct: (product: Product, size: { w: number; h: number }) => Promise<{ ok: boolean; pageIndex?: number }>;
  onAddNativeCard: (entry: AddableDashboardCard, size: { w: number; h: number }) => Promise<{ ok: boolean; pageIndex?: number }>;
};

// Kept separate so `useProductIcon` is unconditional: a published baseName can
// collide with a native id (e.g. 'chat'), and reconciling a published entry to
// a native one under the same key must not change the hook call count.
const PublishedSidebarItemIcon = ({ listing }: { listing: AppListing }) => {
  const icon = browseService.productPreviewFromListing(listing).icon;
  const { data: iconUrl } = useProductIcon(icon);

  return <AddWidgetSidebarIcon alt={listing.manifest.displayName} imageUrl={iconUrl} />;
};

const SidebarItemIcon = ({ entry }: { entry: AddWidgetSidebarEntry }) => {
  const { t } = useTranslation();

  if (entry.source === 'native') {
    return <AddWidgetSidebarIcon alt={t(entry.card.displayNameKey)}>{entry.card.icon}</AddWidgetSidebarIcon>;
  }

  return <PublishedSidebarItemIcon listing={entry.listing} />;
};

const SidebarItem = ({
  entry,
  label,
  isSelected,
  onClick,
}: {
  entry: AddWidgetSidebarEntry;
  label: string;
  isSelected: boolean;
  onClick: () => void;
}) => {
  return (
    <button
      type="button"
      aria-pressed={isSelected}
      className={cnTw(
        'flex h-8 w-full items-center rounded-[6px] px-3 py-1 text-left transition-colors',
        isSelected ? 'bg-bg-selection-container-hover' : 'hover:bg-bg-selection-container-hover',
      )}
      onClick={onClick}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
        <SidebarItemIcon entry={entry} />
        <span className="truncate text-sm leading-5 font-normal text-fg-primary">{label}</span>
      </div>
    </button>
  );
};

const PublishedWidgetPanel = ({
  baseName,
  listing,
  favoriteProductIds,
  dashboardPages,
  onSelectProduct,
  onNavigateToDashboardPage,
}: {
  baseName: string;
  listing: AppListing;
  favoriteProductIds: ReadonlySet<string>;
  dashboardPages: DashboardCard[][];
  onSelectProduct: AddWidgetModalDbProps['onSelectProduct'];
  onNavigateToDashboardPage: (pageIndex: number) => void;
}) => {
  const previewProduct = useMemo(() => browseService.productPreviewFromListing(listing), [listing]);
  const { data: resolvedProduct } = useDisplayedProduct(baseName);
  const product = useMemo(() => {
    const base = resolvedProduct ?? previewProduct;
    return browseService.enrichProductWithListing(base, listing);
  }, [listing, previewProduct, resolvedProduct]);

  // Folder-aware: a product already living inside a user folder counts as
  // "on the dashboard" so the panel offers "Open" instead of "Add" — adding it
  // again would create a duplicate top-level widget alongside the folder entry.
  const dashboardWidgetPlacement = dashboardLayoutService.findProductDashboardPlacement(dashboardPages, product.baseName);

  return (
    <AddWidgetModalProductPanel
      selectedProduct={product}
      favoriteProductIds={favoriteProductIds}
      dashboardWidgetPlacement={dashboardWidgetPlacement}
      onSelectProduct={onSelectProduct}
      onNavigateToDashboardPage={onNavigateToDashboardPage}
    />
  );
};

export const AddWidgetModalDb = ({
  dashboardPages,
  favoriteProductIds,
  isOpen,
  onClose,
  onNavigateToDashboardPage,
  onSelectProduct,
  onAddNativeCard,
}: AddWidgetModalDbProps) => {
  const { t } = useTranslation();
  const addableCards = usePipeline(addableDashboardCardsPipeline, [], {});
  const { data: publishedListings, pending: listingsPending, error: listingsError } = usePublishedWidgetListings(isOpen);

  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const handleClose = () => {
    setSelectedEntryId(null);
    setSearchQuery('');
    onClose();
  };

  const sidebarEntries = useMemo(() => {
    const nativeEntries = buildNativeSidebarEntries(addableCards);
    const publishedEntries = buildPublishedSidebarEntries(publishedListings);
    return mergeAddWidgetSidebarEntries(nativeEntries, publishedEntries, t);
  }, [addableCards, publishedListings, t]);

  const filteredEntries = useMemo(() => filterSidebarEntries(sidebarEntries, searchQuery, t), [sidebarEntries, searchQuery, t]);

  // Resolve against the full list, not the filtered one: a search that hides the
  // current selection must not invalidate it. Otherwise the auto-select effect
  // below clobbers the stored id, and clearing the query lands on the first match
  // instead of the original selection.
  const selectedEntry = useMemo(() => {
    if (!selectedEntryId) return null;
    return sidebarEntries.find(entry => entry.id === selectedEntryId) ?? null;
  }, [sidebarEntries, selectedEntryId]);

  useEffect(() => {
    if (!isOpen) return;
    if (selectedEntry) return;
    if (filteredEntries.length === 0) return;

    setSelectedEntryId(filteredEntries[0]?.id ?? null);
  }, [filteredEntries, isOpen, selectedEntry]);

  const getEntryLabel = (entry: AddWidgetSidebarEntry) => {
    if (entry.source === 'native') return t(entry.card.displayNameKey);
    return entry.listing.manifest.displayName;
  };

  return (
    <Dialog
      modal
      open={isOpen}
      onOpenChange={open => {
        if (!open) handleClose();
      }}
    >
      <Dialog.Content showCloseButton variant="default" size="xl" aria-describedby={undefined}>
        <div className="flex h-[680px] bg-bg-surface-container">
          <div className="flex w-[320px] shrink-0 flex-col gap-4 border-r border-border-primary bg-bg-surface-container pr-6">
            <div className="relative min-h-9">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-fg-secondary" />
              <div className="[&_input]:min-h-9 [&_input]:pl-9">
                <Input
                  type="search"
                  value={searchQuery}
                  placeholder={t('feature.dashboard.addWidget.searchPlaceholder')}
                  aria-label={t('feature.dashboard.addWidget.searchAriaLabel')}
                  onChange={event => setSearchQuery(event.target.value)}
                />
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
              {listingsError ? (
                <p className="px-3 py-4 text-sm text-fg-secondary">{t('feature.dashboard.addWidget.loadFailed')}</p>
              ) : (
                <>
                  {filteredEntries.length > 0 ? (
                    <div className="flex flex-col gap-0">
                      {filteredEntries.map(entry => (
                        <SidebarItem
                          key={entry.id}
                          entry={entry}
                          label={getEntryLabel(entry)}
                          isSelected={selectedEntryId === entry.id}
                          onClick={() => setSelectedEntryId(entry.id)}
                        />
                      ))}
                    </div>
                  ) : listingsPending ? null : (
                    <p className="px-3 py-4 text-sm text-fg-secondary">
                      {searchQuery.trim()
                        ? t('feature.dashboard.addWidget.noSearchResults')
                        : t('feature.dashboard.addWidget.noWidgetsAvailable')}
                    </p>
                  )}
                  {listingsPending ? <AddWidgetSidebarCatalogLoading centered={filteredEntries.length === 0} /> : null}
                </>
              )}
            </div>
          </div>

          {selectedEntry?.source === 'native' ? (
            <div className="grow pl-6">
              <AddWidgetModalNativePanel
                entry={selectedEntry.card}
                dashboardPages={dashboardPages}
                onAddNativeCard={onAddNativeCard}
                onNavigateToDashboardPage={onNavigateToDashboardPage}
              />
            </div>
          ) : selectedEntry?.source === 'published' ? (
            <div className="grow pl-6">
              <PublishedWidgetPanel
                baseName={selectedEntry.baseName}
                listing={selectedEntry.listing}
                favoriteProductIds={favoriteProductIds}
                dashboardPages={dashboardPages}
                onSelectProduct={onSelectProduct}
                onNavigateToDashboardPage={onNavigateToDashboardPage}
              />
            </div>
          ) : (
            <div className="flex min-h-0 min-w-0 flex-1 items-center justify-center bg-bg-surface-container pl-6 text-fg-secondary">
              <p>{t('feature.dashboard.addWidget.selectWidget')}</p>
            </div>
          )}
        </div>
      </Dialog.Content>
    </Dialog>
  );
};
