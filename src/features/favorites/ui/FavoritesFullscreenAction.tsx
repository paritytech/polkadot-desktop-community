import { Maximize2 } from 'lucide-react';

import { IconButton } from '@/shared/components';
import { TEST_IDS } from '@/shared/test-ids';
import { useTranslation } from '@/shared/translation';
import { widgetTopbarActionVisibilityClass } from '@/features/dashboard';
import { useOpenFavorites } from '../hooks/useOpenFavorites';

// Toolbar action injected into the Favorites folder card's topbar — opens the
// fullscreen SPA. Mirrors the chat widget's ChatFullscreenAction.
export const FavoritesFullscreenAction = () => {
  const { t } = useTranslation();
  const openFavorites = useOpenFavorites();

  return (
    <span className={widgetTopbarActionVisibilityClass}>
      <IconButton
        size="sm"
        data-testid={TEST_IDS.favoritesWidgetFullscreenButton}
        label={t('feature.favorites.openFullscreenAria')}
        onClick={openFavorites}
        onMouseDown={event => event.stopPropagation()}
      >
        <Maximize2 aria-hidden />
      </IconButton>
    </span>
  );
};
