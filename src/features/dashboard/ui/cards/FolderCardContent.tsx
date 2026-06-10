import { useState } from 'react';

import { useTranslation } from '@/shared/translation';
import { foldersUseCase } from '@/domains/application';
import { type FolderItemPositions } from '@/domains/application';
import { dotNsService, usePersistedProducts } from '@/domains/product';
import { useOpenProductSurface } from '../../hooks/useOpenProductSurface';
import { getProductIcon } from '../../productIcons';
import { type FolderItem } from '../../types';
import { FolderGrid } from '../folder/FolderGrid';

type Props = {
  cardId: string;
  items: string[];
  positions?: FolderItemPositions;
  isActivePage: boolean;
};

// Folder body — the grid of icon-sized shortcuts. The surrounding card frame
// (topbar with FolderIcon + label + menu) comes from `DashboardCardChrome`;
// this component renders only what lives inside the body.
export const FolderCardContent = ({ cardId, items, positions, isActivePage }: Props) => {
  const { t } = useTranslation();
  const { data: products } = usePersistedProducts();
  const openProduct = useOpenProductSurface();
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const folderItems: FolderItem[] = items
    .map((id): FolderItem | null => {
      const product = products.find(p => p.baseName === id);
      if (!product) return null;
      const NativeIcon = getProductIcon(product.baseName) ?? undefined;
      return {
        widgetId: id,
        icon: product.icon,
        NativeIcon,
        name: dotNsService.toShortLabel(product.baseName),
      };
    })
    .filter((entry): entry is FolderItem => entry !== null);

  const handleRemove = (widgetId: string) => {
    if (!isActivePage) return;
    void foldersUseCase.removeIconFromFolder(widgetId);
  };

  const handleChangePositions = (next: FolderItemPositions) => {
    if (!isActivePage) return;
    void foldersUseCase.setFolderItemPositions(cardId, next);
  };

  if (folderItems.length === 0) {
    return (
      <div className="flex h-full items-center justify-center px-4 text-center">
        <p className="text-body-m-regular text-fg-secondary">{t('feature.dashboard.favorites.empty')}</p>
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-y-auto">
      <FolderGrid
        folderId={cardId}
        items={folderItems}
        positions={positions}
        openMenuId={openMenuId}
        onMenuOpenChange={(menuId, open) => setOpenMenuId(prev => (open ? menuId : prev === menuId ? null : prev))}
        onOpenWidget={openProduct}
        onRemoveWidget={handleRemove}
        onChangeWidgetPositions={handleChangePositions}
      />
    </div>
  );
};
