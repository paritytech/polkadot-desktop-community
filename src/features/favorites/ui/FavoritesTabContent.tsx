import { Star } from 'lucide-react';

import { TabChip } from '@/shared/components';
import { useTranslation } from '@/shared/translation';

type Props = { isActive: boolean };

// The Favorites tab-strip chip (icon + label), rendered into the browser's
// `tabContentSlot` for the Favorites system tab.
export const FavoritesTabContent = ({ isActive }: Props) => {
  const { t } = useTranslation();

  return <TabChip icon={<Star aria-hidden />} isActive={isActive} label={t('feature.favorites.title')} />;
};
