import { Dialog } from '@novasamatech/tr-ui';
import { useNavigate } from '@tanstack/react-router';
import { useCallback, useMemo } from 'react';

import { dashboardLayoutService, useDashboardLayouts, useFavoriteProductIds } from '@/domains/application';
import { browseService, usePublishedWidgetListings } from '@/domains/product';
import { type Product, usePersistedProducts } from '@/domains/product';
import { useAddProductToDashboard } from '@/aggregates/product-management';

import { AddWidgetModalProductPanel } from './add-widget/AddWidgetModalProductPanel';

type FavoriteSizeSelectorModalProps = {
  product: Product;
  isOpen: boolean;
  onClose: () => void;
};

export const FavoriteSizeSelectorModal = ({ product, isOpen, onClose }: FavoriteSizeSelectorModalProps) => {
  const navigate = useNavigate();
  const { data: products = [] } = usePersistedProducts();
  const { pages } = useDashboardLayouts();
  const { data: favoriteProductIds } = useFavoriteProductIds();
  const { data: publishedListings } = usePublishedWidgetListings(isOpen);
  const addProductToDashboard = useAddProductToDashboard();

  const dashboardWidgetPlacement = useMemo(
    () => dashboardLayoutService.findWidgetPlacement(pages, product.baseName),
    [pages, product.baseName],
  );

  const displayProduct = useMemo((): Product => {
    const stored = products.find(p => p.baseName === product.baseName) ?? product;
    const listing = browseService.findListingByBaseName(publishedListings, product.baseName);
    return browseService.enrichProductWithListing(stored, listing);
  }, [product, products, publishedListings]);

  const handleNavigateToDashboardPage = useCallback(
    (pageIndex: number) => {
      onClose();
      navigate({ to: '/dashboard', search: { page: pageIndex } });
    },
    [navigate, onClose],
  );

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
        variant="default"
        size="lg"
        aria-describedby={undefined}
        onOpenAutoFocus={event => event.preventDefault()}
      >
        <div className="flex h-[680px] bg-bg-surface-container">
          <AddWidgetModalProductPanel
            selectedProduct={displayProduct}
            favoriteProductIds={favoriteProductIds}
            dashboardWidgetPlacement={dashboardWidgetPlacement}
            onSelectProduct={addProductToDashboard}
            onNavigateToDashboardPage={handleNavigateToDashboardPage}
          />
        </div>
      </Dialog.Content>
    </Dialog>
  );
};
