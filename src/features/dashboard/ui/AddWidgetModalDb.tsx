import { useEffect, useMemo, useState } from 'react';

import { Dialog, Input } from '@/shared/components';
import { useTransformer } from '@/shared/di';
import { SearchIcon } from '@/shared/icons';
import { TEST_IDS } from '@/shared/test-ids';
import { useTranslation } from '@/shared/translation';
import { cnTw } from '@/shared/utils';
import { type DashboardCard } from '@/domains/application';
import { useDotNsTld } from '@/domains/product';
import { type AddWidgetPanelContext, addWidgetPanelTransformer } from '../di';
import { useAddableDashboardCards } from '../hooks/useAddableDashboardCards';
import { addWidgetModalOpen, useAddWidgetCatalogSources } from '../state/addWidgetCatalog';

import { AddWidgetSidebarCatalogLoading } from './add-widget/AddWidgetSidebarCatalogLoading';
import { AddWidgetSidebarIcon } from './add-widget/AddWidgetSidebarIcon';
import {
  buildContributedSidebarEntries,
  buildNativeSidebarEntries,
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
};

const SidebarItemIcon = ({ entry }: { entry: AddWidgetSidebarEntry }) => {
  const { t } = useTranslation();

  if (entry.source === 'native') {
    return <AddWidgetSidebarIcon alt={t(entry.card.displayNameKey)}>{entry.card.icon}</AddWidgetSidebarIcon>;
  }

  return <>{entry.entry.renderIcon()}</>;
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
      data-testid={TEST_IDS.addWidgetSidebarItem}
      aria-pressed={isSelected}
      className={cnTw(
        'flex h-control w-full items-center rounded-md px-3 text-start transition-colors',
        isSelected ? 'bg-bg-selection-container-hover' : 'hover:bg-bg-selection-container-hover',
      )}
      onClick={onClick}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
        <SidebarItemIcon entry={entry} />
        <span className="truncate text-sm font-normal text-fg-primary">{label}</span>
      </div>
    </button>
  );
};

// Resolves the panel for any selected sidebar entry through the content-agnostic
// transformer (the dashboard host claims native entries, content providers the
// rest). Returns `null` while no provider claims the entry (identical to the
// prior "nothing while unresolved" behavior).
const SelectedEntryPanel = ({ entry, context }: { entry: AddWidgetSidebarEntry; context: AddWidgetPanelContext }) => {
  const node = useTransformer(addWidgetPanelTransformer, { entry, context });
  return node ?? null;
};

export const AddWidgetModalDb = ({
  dashboardPages,
  favoriteProductIds,
  isOpen,
  onClose,
  onNavigateToDashboardPage,
}: AddWidgetModalDbProps) => {
  const { t } = useTranslation();
  const { data: tld } = useDotNsTld();
  const { cards: addableCards } = useAddableDashboardCards();
  const catalogSources = useAddWidgetCatalogSources();

  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Drive the shared open-state so catalog providers (e.g. published listings) only
  // load while the modal is open, preserving the prior `usePublishedWidgetListings(isOpen)`.
  useEffect(() => {
    addWidgetModalOpen.set(isOpen);
  }, [isOpen]);

  const handleClose = () => {
    setSelectedEntryId(null);
    setSearchQuery('');
    onClose();
  };

  // Aggregate contributed catalog slices across every provider so a single source's
  // load drives the shared spinner / load-failed message.
  const { contributedEntries, catalogPending, catalogError } = useMemo(() => {
    const entries = [];
    let pending = false;
    let error = false;
    for (const source of catalogSources.values()) {
      entries.push(...source.entries);
      pending = pending || source.pending;
      error = error || source.error;
    }
    return { contributedEntries: entries, catalogPending: pending, catalogError: error };
  }, [catalogSources]);

  const sidebarEntries = useMemo(() => {
    const nativeEntries = buildNativeSidebarEntries(addableCards);
    const contributed = buildContributedSidebarEntries(contributedEntries);
    return mergeAddWidgetSidebarEntries(nativeEntries, contributed, t);
  }, [addableCards, contributedEntries, t]);

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
    return entry.entry.label;
  };

  const panelContext = useMemo<AddWidgetPanelContext>(
    () => ({ dashboardPages, favoriteProductIds, onNavigateToDashboardPage }),
    [dashboardPages, favoriteProductIds, onNavigateToDashboardPage],
  );

  return (
    <Dialog.Root
      modal
      open={isOpen}
      onOpenChange={open => {
        if (!open) handleClose();
      }}
    >
      <Dialog.Content width="xl" aria-describedby={undefined}>
        <div className="flex h-170">
          <div className="flex w-72 shrink-0 flex-col gap-4 border-e border-stroke-primary pe-6">
            <Input
              leading={<SearchIcon />}
              type="search"
              data-testid={TEST_IDS.addWidgetSearchInput}
              value={searchQuery}
              placeholder={t('feature.dashboard.addWidget.searchPlaceholder', { tld })}
              aria-label={t('feature.dashboard.addWidget.searchAriaLabel')}
              onChange={event => setSearchQuery(event.target.value)}
            />

            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
              {catalogError ? (
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
                  ) : catalogPending ? null : (
                    <p className="px-3 py-4 text-sm text-fg-secondary" data-testid={TEST_IDS.addWidgetNoResults}>
                      {searchQuery.trim()
                        ? t('feature.dashboard.addWidget.noSearchResults')
                        : t('feature.dashboard.addWidget.noWidgetsAvailable')}
                    </p>
                  )}
                  {catalogPending ? <AddWidgetSidebarCatalogLoading centered={filteredEntries.length === 0} /> : null}
                </>
              )}
            </div>
          </div>

          {selectedEntry ? (
            <div className="grow ps-6">
              <SelectedEntryPanel entry={selectedEntry} context={panelContext} />
            </div>
          ) : (
            <div className="flex min-h-0 min-w-0 flex-1 items-center justify-center ps-6 text-fg-secondary">
              <p>{t('feature.dashboard.addWidget.selectWidget')}</p>
            </div>
          )}
        </div>
      </Dialog.Content>
    </Dialog.Root>
  );
};
