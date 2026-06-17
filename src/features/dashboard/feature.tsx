import { AppIcon } from '@novasamatech/tr-ui';
import { LayoutGrid } from 'lucide-react';
import { FormattedMessage } from 'react-intl';

import { createFeature } from '@/shared/feature';
import { type DashboardCardLayoutRules, FAVORITES_FOLDER_ID } from '@/domains/application';
import { DASHBOARD_TAB_ID } from '@/aggregates/browser-tabs';
import { persistentSlot, topBarLeadingSlot } from '@/features/app-shell';
import { tabContentSlot, tabHoverSlot } from '@/features/browser';
import { productActionsMenuItemsSlot } from '@/features/product-actions-menu';

import { type AddableDashboardCard, dashboardCardSDK } from './di';
import { type DashboardCardMetadata } from './types';
import { AddToDashboardDialogHost } from './ui/AddToDashboardDialogHost';
import { DashboardCardChrome } from './ui/DashboardCardChrome';
import { DashboardTabBinding } from './ui/DashboardTabBinding';
import { DashboardTabContent } from './ui/DashboardTabContent';
import { DashboardTabHover } from './ui/DashboardTabHover';
import { HomeButton } from './ui/HomeButton';
import { ProductDashboardMenuItem } from './ui/ProductDashboardMenuItem';
import { ProductDashboardShortcutBinding } from './ui/ProductDashboardShortcutBinding';
import { FolderCardContent } from './ui/cards/FolderCardContent';

export const dashboardFeature = createFeature({
  name: 'application/dashboard',
});

dashboardFeature.inject(topBarLeadingSlot, {
  order: 0,
  render: () => <HomeButton />,
});

dashboardFeature.inject(productActionsMenuItemsSlot, {
  order: 10,
  render: ({ productId, closeMenu }) => <ProductDashboardMenuItem productId={productId} closeMenu={closeMenu} />,
});

dashboardFeature.inject(tabContentSlot, ({ tab, isActive }) =>
  tab.type === DASHBOARD_TAB_ID ? <DashboardTabContent isActive={isActive} /> : null,
);
dashboardFeature.inject(tabHoverSlot, ({ tab }) => (tab.type === DASHBOARD_TAB_ID ? <DashboardTabHover /> : null));
dashboardFeature.inject(persistentSlot, () => <DashboardTabBinding />);
dashboardFeature.inject(persistentSlot, () => <AddToDashboardDialogHost />);
dashboardFeature.inject(persistentSlot, () => <ProductDashboardShortcutBinding />);

const FOLDER_LAYOUT_RULES: DashboardCardLayoutRules = {
  minH: 2,
  maxH: 8,
  minW: 1,
  maxW: 1,
  menuSizes: ['small', 'medium', 'large'],
};

type FolderPayload = {
  kind: 'folder';
  items: string[];
  positions?: Record<string, { x: number; y: number }>;
};

const FOLDER_METADATA: DashboardCardMetadata = {
  icon: (
    <AppIcon size="sm" alt="">
      <LayoutGrid className="size-4" aria-hidden />
    </AppIcon>
  ),
  label: <FormattedMessage id="feature.dashboard.favorites.title" />,
  removeLabel: <FormattedMessage id="feature.dashboard.favorites.removeFolder" />,
};

const FAVORITES_ADDABLE_KIND = 'folder:favorites';

const favoritesAddableEntry: AddableDashboardCard = {
  kind: FAVORITES_ADDABLE_KIND,
  gridId: FAVORITES_FOLDER_ID,
  displayNameKey: 'feature.dashboard.favorites.title',
  descriptionKey: 'feature.dashboard.addWidget.cards.favorites.description',
  icon: <LayoutGrid className="size-full" aria-hidden />,
  defaultLayoutRules: FOLDER_LAYOUT_RULES,
  widgetCard: {
    titleKey: 'feature.dashboard.addWidget.cards.favorites.title',
    descriptionKey: 'feature.dashboard.addWidget.cards.favorites.description',
    previewVariant: 'small',
    sizeVariants: ['small', 'medium', 'large'],
  },
  createCard: () => ({
    payload: { kind: 'folder', items: [] },
    gridSize: { w: 1, h: 2 },
  }),
};

// Folder is implemented as a regular card kind, registered via the same SDK
// every other native module uses.
dashboardCardSDK(dashboardFeature, {
  content: props => {
    if (props.card.payload.kind !== 'folder') return null;
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const folderPayload = props.card.payload as FolderPayload;
    return (
      <DashboardCardChrome
        card={props.card}
        width={props.width}
        height={props.height}
        layoutRules={FOLDER_LAYOUT_RULES}
        isMenuOpen={props.isMenuOpen}
        onMenuOpenChange={open => props.onMenuOpenChange(props.menuId, open)}
        onResizeCard={props.onResizeCard}
        onRemoveCard={props.onRemoveCard}
        onCleanupCards={props.onCleanupCards}
      >
        <FolderCardContent
          cardId={props.card.i}
          items={folderPayload.items}
          positions={folderPayload.positions}
          isActivePage={props.isActivePage}
        />
      </DashboardCardChrome>
    );
  },
  metadata: payload => (payload.kind === 'folder' ? FOLDER_METADATA : null),
  addable: entries => [...entries, favoritesAddableEntry],
});
