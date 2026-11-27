import { type DragEndEvent, DndContext, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, arrayMove, rectSortingStrategy } from '@dnd-kit/sortable';
import { useEffect, useMemo, useState } from 'react';
import { FormattedMessage } from 'react-intl';

import PlusIcon from '@/shared/assets/images/icons/plus.svg?jsx';
import SearchXIcon from '@/shared/assets/images/icons/search-x.svg?jsx';
import SearchIcon from '@/shared/assets/images/icons/search.svg?jsx';
import StarOffIcon from '@/shared/assets/images/icons/star-off.svg?jsx';
import StarIcon from '@/shared/assets/images/icons/star.svg?jsx';
import { AppIcon, Button, EmptyState, IconButton, Input } from '@/shared/components';
import { TEST_IDS } from '@/shared/test-ids';
import { useTranslation } from '@/shared/translation';
import { FAVORITES_FOLDER_ID, foldersUseCase, useFavoriteProductIds, useRemoveItemFromFolder } from '@/domains/application';
import { useDotNsLabels } from '@/domains/product';
import { isNativeAddableDashboardId, openFavoriteItemSideEffect } from '@/features/dashboard';
import { favoritesService } from '../service';
import { openAddToFavoritesDialog } from '../state/addToFavoritesDialog';

import { SortableFavoriteItem } from './SortableFavoriteItem';

export const FavoritesFullscreen = () => {
  const { t } = useTranslation();
  const { data: favoriteIds } = useFavoriteProductIds();
  const { removeItemFromFolder } = useRemoveItemFromFolder();
  const [query, setQuery] = useState('');

  // Product-centric SPA: render every product favourite by id (resolved per card),
  // so catalog-added favourites show even when not installed. Native items (e.g.
  // chat) are excluded — they open from their own surfaces, not this SPA.
  const favoriteItemIds = useMemo(() => [...favoriteIds].filter(itemId => !isNativeAddableDashboardId(itemId)), [favoriteIds]);

  // Local drag order, reconciled with the live favourite set (keep known order,
  // append new ids, drop removed ones). Reordering persists through the domain, so
  // this only smooths the optimistic update between drag and re-emit.
  const [order, setOrder] = useState<string[]>(favoriteItemIds);
  useEffect(() => {
    setOrder(prev => {
      const live = new Set(favoriteItemIds);
      const kept = prev.filter(id => live.has(id));
      const added = favoriteItemIds.filter(id => !prev.includes(id));
      const next = [...kept, ...added];
      return next.length === prev.length && next.every((id, index) => id === prev[index]) ? prev : next;
    });
  }, [favoriteItemIds]);

  const labels = useDotNsLabels();

  const hasQuery = query.trim().length > 0;

  const visibleIds = useMemo(
    () => favoritesService.filterByTitle(order, query, itemId => labels.shortLabel(itemId)),
    [order, query, labels],
  );

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleOpen = (itemId: string) => {
    void openFavoriteItemSideEffect.apply({ itemId });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = order.indexOf(String(active.id));
    const newIndex = order.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;

    const next = arrayMove(order, oldIndex, newIndex);
    setOrder(next);
    void foldersUseCase.reorderFolderItems(FAVORITES_FOLDER_ID, next);
  };

  const renderRemoveAction = (itemId: string) => (
    <IconButton
      size="sm"
      variant="raised"
      label={t('feature.favorites.removeAria')}
      data-testid={TEST_IDS.favoritesCardRemove}
      onPointerDown={event => event.stopPropagation()}
      onClick={() => removeItemFromFolder(itemId)}
    >
      <StarOffIcon />
    </IconButton>
  );

  return (
    <div
      data-testid={TEST_IDS.favoritesFullscreen}
      className="flex h-full w-full flex-col overflow-hidden bg-bg-surface-container p-2"
    >
      <div className="flex items-center gap-2 px-2">
        <AppIcon size="24" alt="">
          <StarIcon className="size-4" />
        </AppIcon>
        <span className="flex-1 text-sm font-semibold text-fg-primary">
          <FormattedMessage id="feature.favorites.title" />
        </span>
        <IconButton
          size="sm"
          label={t('feature.favorites.addAria')}
          data-testid={TEST_IDS.favoritesAddButton}
          onClick={openAddToFavoritesDialog}
        >
          <PlusIcon />
        </IconButton>
      </div>

      <div className="pt-4">
        <div className="px-2">
          <Input
            leading={<SearchIcon />}
            type="search"
            data-testid={TEST_IDS.favoritesSearchInput}
            value={query}
            placeholder={t('feature.favorites.searchPlaceholder')}
            aria-label={t('feature.favorites.searchAriaLabel')}
            onChange={event => setQuery(event.target.value)}
          />
        </div>
      </div>

      {order.length === 0 ? (
        <EmptyState
          testId={TEST_IDS.favoritesEmptyState}
          icon={<StarIcon />}
          title={<FormattedMessage id="feature.favorites.emptyTitle" />}
          description={<FormattedMessage id="feature.favorites.emptyDescription" />}
          action={
            <Button variant="primary" size="sm" data-testid={TEST_IDS.favoritesBrowseApps} onClick={openAddToFavoritesDialog}>
              <FormattedMessage id="feature.favorites.browseApps" />
            </Button>
          }
        />
      ) : visibleIds.length === 0 ? (
        <EmptyState
          testId={TEST_IDS.favoritesSearchNoResults}
          icon={<SearchXIcon />}
          title={<FormattedMessage id="feature.favorites.searchNoResults.title" />}
          description={<FormattedMessage id="feature.favorites.searchNoResults.description" />}
        />
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={visibleIds} strategy={rectSortingStrategy}>
            <div className="grid flex-1 auto-rows-min grid-cols-6 gap-2 overflow-y-auto p-2">
              {visibleIds.map(itemId => (
                <SortableFavoriteItem
                  key={itemId}
                  itemId={itemId}
                  disabled={hasQuery}
                  action={renderRemoveAction(itemId)}
                  onOpen={() => handleOpen(itemId)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
};
