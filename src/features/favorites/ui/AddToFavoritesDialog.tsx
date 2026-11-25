import { Dialog, Input } from '@novasamatech/tr-ui';
import { CircleAlert, LayoutGrid, RotateCw, Search, SearchX, Star, StarOff } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { FormattedMessage } from 'react-intl';

import { Button, Spinner } from '@/shared/components';
import { TEST_IDS } from '@/shared/test-ids';
import { useTranslation } from '@/shared/translation';
import { cnTw } from '@/shared/utils';
import { useAddToFavorites, useFavoriteProductIds, useRemoveItemFromFolder } from '@/domains/application';
import { browseService, dotNsService, useDotNsTld, usePublishedAppListings } from '@/domains/product';
import { favoritesService } from '../service';

import { FavoriteProductCard } from './FavoriteProductCard';
import { FavoritesStatePlaceholder } from './FavoritesStatePlaceholder';

type Props = {
  isOpen: boolean;
  onClose: VoidFunction;
};

// The "Add to Favorites" dialog (macro node 1533-17054): a searchable grid of the
// published SPA (`app`-modality) catalog — the same browse source the Add-Widget
// modal uses, filtered to SPA instead of widget. Each card carries a favorite
// toggle (add / remove); membership is read live so the toggle reflects state.
export const AddToFavoritesDialog = ({ isOpen, onClose }: Props) => {
  const { t } = useTranslation();
  // Gated on `isOpen` so the browse-chain listing only loads while the dialog is up.
  const { data: listings, pending, error, refresh } = usePublishedAppListings(isOpen);
  const { data: favoriteIds, pending: favoritesPending } = useFavoriteProductIds();
  const { addToFavorites } = useAddToFavorites();
  const { removeItemFromFolder } = useRemoveItemFromFolder();
  const [query, setQuery] = useState('');

  // Snapshot the already-favorite ids the moment the dialog opens. The list shows
  // only non-favorites at open time; adding one during the session keeps it in the
  // list (its star just un-crosses) instead of dropping it out from under the cursor.
  const [excludedAtOpen, setExcludedAtOpen] = useState<ReadonlySet<string>>(() => new Set());
  // Until the suffix is settled it is a guess, and `addToFavorites` persists the
  // id built from it — so an unsettled or failed read holds the whole grid back
  // rather than offering cards that would be favourited under the wrong name.
  const { data: tld, pending: tldPending, error: tldError, refresh: refreshTld } = useDotNsTld();

  // Snapshot once per open, on the first settled membership read — keyed on
  // `isOpen` + `favoritesPending` only (NOT live favoriteIds), so adding a product
  // mid-session doesn't re-run this and drop it from the list. Snapshotting at
  // mount instead would capture the empty default whenever the layout read has not
  // settled yet, and nothing would re-run it — already-favorite products would then
  // be offered for adding.
  useEffect(() => {
    if (isOpen && !favoritesPending) setExcludedAtOpen(new Set(favoriteIds));
  }, [isOpen, favoritesPending]);

  const products = useMemo(
    () =>
      listings
        .map(listing => browseService.productPreviewFromListing(listing, browseService.listingBaseName(listing, tld)))
        .filter(product => !excludedAtOpen.has(product.baseName)),
    [listings, excludedAtOpen, tld],
  );

  const visibleProducts = useMemo(
    () => favoritesService.filterByTitle(products, query, product => dotNsService.toShortLabel(product.baseName, tld)),
    [products, query, tld],
  );

  const hasQuery = query.trim().length > 0;

  const toggle = (baseName: string) => {
    if (favoriteIds.has(baseName)) removeItemFromFolder(baseName);
    else addToFavorites(baseName);
  };

  return (
    <Dialog
      modal
      open={isOpen}
      onOpenChange={open => {
        if (!open) onClose();
      }}
    >
      <Dialog.Content
        showCloseButton
        variant="tall"
        size="md"
        aria-describedby={undefined}
        data-testid={TEST_IDS.addToFavoritesDialog}
      >
        <h2 className="text-lg leading-7 font-semibold text-fg-primary">
          <FormattedMessage id="feature.favorites.addDialog.title" />
        </h2>

        <div className="relative min-h-9 shrink-0">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-5 -translate-y-1/2 text-fg-secondary" />
          <div className="[&_input]:min-h-9 [&_input]:ps-9" data-testid={TEST_IDS.addToFavoritesSearchInput}>
            <Input
              type="search"
              value={query}
              placeholder={t('feature.favorites.addDialog.searchPlaceholder')}
              aria-label={t('feature.favorites.addDialog.searchAriaLabel')}
              onChange={event => setQuery(event.target.value)}
            />
          </div>
        </div>

        {/* Fixed-height scroll area: the frame stays put while the results/empty
            state change, so filtering never resizes the dialog. */}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {pending || tldPending || favoritesPending ? (
            <div
              role="status"
              aria-label={t('feature.favorites.addDialog.loadingAria')}
              data-testid={TEST_IDS.addToFavoritesLoading}
              className="flex min-h-40 flex-1 items-center justify-center text-fg-secondary"
            >
              <Spinner size={48} />
            </div>
          ) : error || tldError ? (
            <FavoritesStatePlaceholder
              testId={TEST_IDS.addToFavoritesError}
              icon={<CircleAlert className="size-5" aria-hidden />}
              title={<FormattedMessage id="feature.favorites.addDialog.error.title" />}
              action={
                <Button
                  size="sm"
                  data-testid={TEST_IDS.addToFavoritesRetry}
                  onClick={() => {
                    refresh();
                    refreshTld();
                  }}
                >
                  <RotateCw className="size-4" aria-hidden />
                  <FormattedMessage id="feature.favorites.addDialog.error.retry" />
                </Button>
              }
            />
          ) : visibleProducts.length === 0 ? (
            hasQuery ? (
              <FavoritesStatePlaceholder
                testId={TEST_IDS.addToFavoritesNoResults}
                icon={<SearchX className="size-5" aria-hidden />}
                title={<FormattedMessage id="feature.favorites.addDialog.noResults.title" />}
                description={<FormattedMessage id="feature.favorites.addDialog.noResults.description" />}
              />
            ) : (
              <FavoritesStatePlaceholder
                testId={TEST_IDS.addToFavoritesNothingToAdd}
                icon={<LayoutGrid className="size-5" aria-hidden />}
                title={<FormattedMessage id="feature.favorites.addDialog.nothingToAdd.title" />}
                description={<FormattedMessage id="feature.favorites.addDialog.nothingToAdd.description" />}
              />
            )
          ) : (
            <div className="grid auto-rows-min grid-cols-3 gap-4">
              {visibleProducts.map(product => {
                const isFavorite = favoriteIds.has(product.baseName);

                return (
                  <FavoriteProductCard
                    key={product.baseName}
                    product={product}
                    action={
                      <button
                        type="button"
                        data-testid={TEST_IDS.addToFavoritesToggle}
                        aria-label={isFavorite ? t('feature.favorites.removeAria') : t('feature.favorites.addAria')}
                        aria-pressed={isFavorite}
                        className={cnTw(
                          'flex size-8 cursor-pointer items-center justify-center rounded-full',
                          'bg-bg-action-active text-fg-primary hover:brightness-95',
                        )}
                        onClick={() => toggle(product.baseName)}
                      >
                        {/* The button is revealed on hover and toggles membership, so it shows the ACTION it
                            performs — a star to add, a crossed star to remove — not the current state. */}
                        {isFavorite ? <StarOff className="size-4" aria-hidden /> : <Star className="size-4" aria-hidden />}
                      </button>
                    }
                  />
                );
              })}
            </div>
          )}
        </div>
      </Dialog.Content>
    </Dialog>
  );
};
