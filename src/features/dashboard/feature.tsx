import { Star } from 'lucide-react';
import { FormattedMessage } from 'react-intl';

import { AppIcon } from '@/shared/components';
import { createFeature } from '@/shared/feature';
import { TEST_IDS } from '@/shared/test-ids';
import { type DashboardCardLayoutRules, FAVORITES_FOLDER_ID, cardsUseCase, dashboardLayoutService } from '@/domains/application';
import { DASHBOARD_TAB_ID } from '@/aggregates/browser-tabs';
import { persistentSlot, topBarLeadingSlot } from '@/features/app-shell';
import { tabContentSlot, tabHoverSlot } from '@/features/browser';

import { isNativeAddableDashboardId, lookupAddableDashboardCardByGridId } from './addableDashboardCards';
import {
  type AddableDashboardCard,
  addToDashboardModalTransformer,
  addWidgetPanelTransformer,
  dashboardCardSDK,
  folderItemContentTransformer,
} from './di';
import { buildNativeDashboardCard } from './nativeDashboardCards';
import { type DashboardCardMetadata } from './types';
import { AddToDashboardDialogHost } from './ui/AddToDashboardDialogHost';
import { DashboardCardChrome } from './ui/DashboardCardChrome';
import { DashboardTabBinding } from './ui/DashboardTabBinding';
import { DashboardTabContent } from './ui/DashboardTabContent';
import { DashboardTabHover } from './ui/DashboardTabHover';
import { HomeButton } from './ui/HomeButton';
import { NativeAddToDashboardModal } from './ui/NativeAddToDashboardModal';
import { NativeAddWidgetPanelResolver } from './ui/add-widget/NativeAddWidgetPanelResolver';
import { FolderCardContent } from './ui/cards/FolderCardContent';
import { NativeFolderItemContent } from './ui/cards/NativeFolderItemContent';

export const dashboardFeature = createFeature({
  name: 'application/dashboard',
});

dashboardFeature.inject(topBarLeadingSlot, {
  order: 0,
  render: () => <HomeButton />,
});

dashboardFeature.inject(tabContentSlot, ({ tab, isActive }) =>
  tab.type === DASHBOARD_TAB_ID ? <DashboardTabContent isActive={isActive} /> : null,
);
dashboardFeature.inject(tabHoverSlot, ({ tab }) => (tab.type === DASHBOARD_TAB_ID ? <DashboardTabHover /> : null));
dashboardFeature.inject(persistentSlot, () => <DashboardTabBinding />);
dashboardFeature.inject(persistentSlot, () => <AddToDashboardDialogHost />);

// The dashboard owns the native Add-to-Dashboard modal handler — a native grid
// id never resolves to a chain product, so claiming it here keeps the prior
// "skip the product round-trip for native entries" behavior. Content providers
// (e.g. `product-dashboard`) register their own handler for non-native targets.
dashboardFeature.inject(addToDashboardModalTransformer, ({ targetId, onClose }) => {
  const nativeEntry = lookupAddableDashboardCardByGridId(targetId);
  if (!nativeEntry) return null;
  return <NativeAddToDashboardModal entry={nativeEntry} isOpen onClose={onClose} />;
});

// The dashboard owns the native favourites-folder item content handler. Native
// is claimed first — a native grid id never resolves to a chain product, so this
// keeps the prior "skip the product round-trip for native entries" behavior
// (chat's native entry rendering goes through the native handler). Content
// providers claim every non-native id with their own handler.
dashboardFeature.inject(folderItemContentTransformer, ({ itemId, iconSize }) => {
  if (!isNativeAddableDashboardId(itemId)) return null;
  return <NativeFolderItemContent itemId={itemId} iconSize={iconSize} />;
});

// The dashboard owns the native Add-Widget panel handler — native entries route
// through the same panel transformer every content provider uses (rather than the
// modal branching on `source === 'native'` inline). Content providers register
// their own handler for contributed entries.
dashboardFeature.inject(addWidgetPanelTransformer, ({ entry, context }) =>
  entry.source === 'native' ? <NativeAddWidgetPanelResolver entry={entry.card} context={context} /> : null,
);

const FOLDER_LAYOUT_RULES: DashboardCardLayoutRules = {
  minH: 2,
  maxH: 8,
  minW: 1,
  maxW: 1,
  switchableSizes: ['small', 'medium', 'large'],
};

type FolderPayload = {
  kind: 'folder';
  items: string[];
};

const FOLDER_METADATA: DashboardCardMetadata = {
  icon: (
    <AppIcon size="24" alt="">
      <Star className="size-4" aria-hidden />
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
  icon: <Star className="size-full" aria-hidden />,
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
    const maxVisibleItems = dashboardLayoutService.getMaxVisibleFavorites(props.width, props.height);
    // The macro scales the app icon with the folder, so the domain's size variant
    // (not a pixel value — that vocabulary stays out of the domain) picks it here.
    const iconSize = dashboardLayoutService.getVariantFromGridSize(props.width, props.height) === 'large' ? '64' : '44';
    return (
      <DashboardCardChrome
        card={props.card}
        width={props.width}
        height={props.height}
        layoutRules={FOLDER_LAYOUT_RULES}
        testId={TEST_IDS.dashboardFavoritesFolder}
        isMenuOpen={props.isMenuOpen}
        onMenuOpenChange={open => props.onMenuOpenChange(props.menuId, open)}
        onResizeCard={props.onResizeCard}
        onRemoveCard={props.onRemoveCard}
        onCleanupCards={props.onCleanupCards}
      >
        <FolderCardContent
          cardId={props.card.i}
          items={folderPayload.items}
          isActivePage={props.isActivePage}
          maxVisibleItems={maxVisibleItems}
          iconSize={iconSize}
        />
      </DashboardCardChrome>
    );
  },
  metadata: payload => (payload.kind === 'folder' ? FOLDER_METADATA : null),
  addable: entries => [...entries, favoritesAddableEntry],
  // Plain handler — adding is a pure data op over the domain use case, no React.
  // The Favorites folder can't itself be favourited (no 1×1 path), so it always
  // places a widget card, even when empty.
  add: request => {
    if ('product' in request || request.kind !== FAVORITES_ADDABLE_KIND) return null;
    return cardsUseCase.addCardToLayout(buildNativeDashboardCard(request.entry, request.size));
  },
});
