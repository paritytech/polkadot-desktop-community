import { createFeature } from '@/shared/feature';
import { persistentSlot } from '@/features/app-shell';
import { tabContentSlot } from '@/features/browser';
import { dashboardCardActionsSlot, openAddToFavoritesSideEffect } from '@/features/dashboard';

import { openAddToFavoritesDialog } from './state/addToFavoritesDialog';
import { FAVORITES } from './tabs';
import { AddToFavoritesDialogHost } from './ui/AddToFavoritesDialogHost';
import { FavoritesFullscreenAction } from './ui/FavoritesFullscreenAction';
import { FavoritesOpenBinding } from './ui/FavoritesOpenBinding';
import { FavoritesTabBinding } from './ui/FavoritesTabBinding';
import { FavoritesTabContent } from './ui/FavoritesTabContent';

export const favoritesFeature = createFeature({
  name: 'application/favorites',
});

// The Favorites folder card is owned by the dashboard host; this feature only
// contributes the "open fullscreen" toolbar action for it, keeping the dashboard
// content-agnostic. Named after the place of use (the card actions slot).
favoritesFeature.inject(dashboardCardActionsSlot, ({ payload }) =>
  payload.kind === 'folder' ? <FavoritesFullscreenAction /> : null,
);

// System-tab wiring (mirrors chat): the Favorites SPA opens as a browser tab that
// shows in the tab strip. The content chip is keyed on the tab type;
// the route↔tab binding keeps the strip in sync with `/favorites`.
favoritesFeature.inject(tabContentSlot, ({ tab, isActive }) =>
  tab.type === FAVORITES ? <FavoritesTabContent isActive={isActive} /> : null,
);
favoritesFeature.inject(persistentSlot, () => <FavoritesTabBinding />);
favoritesFeature.inject(persistentSlot, () => <FavoritesOpenBinding />);

// Mounted persistently rather than inside the SPA: the folder widget on the
// dashboard opens this dialog while the Favorites tab is closed.
favoritesFeature.inject(persistentSlot, () => <AddToFavoritesDialogHost />);

// This feature owns the dialog, so it answers the dashboard's seam. The SPA's own
// buttons set the same state directly — they don't need to leave the feature.
favoritesFeature.inject(openAddToFavoritesSideEffect, openAddToFavoritesDialog);
