import { Maximize2Icon } from '@/shared/icons';
import { TEST_IDS } from '@/shared/test-ids';
import { useTranslation } from '@/shared/translation';
import { WidgetTopbarAction } from '@/features/dashboard';
import { useOpenFavorites } from '../hooks/useOpenFavorites';

// Toolbar action injected into the Favorites folder card's topbar — opens the
// fullscreen SPA. Mirrors the chat widget's ChatFullscreenAction.
export const FavoritesFullscreenAction = () => {
  const { t } = useTranslation();
  const openFavorites = useOpenFavorites();

  return (
    <WidgetTopbarAction
      data-testid={TEST_IDS.favoritesWidgetFullscreenButton}
      label={t('feature.favorites.openFullscreenAria')}
      onClick={openFavorites}
    >
      <Maximize2Icon />
    </WidgetTopbarAction>
  );
};
