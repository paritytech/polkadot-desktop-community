import { Palette } from 'lucide-react';

import { Sidebar } from '@/shared/components';
import { createFeature } from '@/shared/feature';
import { useTranslation } from '@/shared/translation';
import { settingsPreferencesNavSlot } from '@/features/settings';

export const themeToggleFeature = createFeature({
  name: 'theme/toggle',
});

themeToggleFeature.inject(settingsPreferencesNavSlot, {
  order: 0,
  render: () => {
    const { t } = useTranslation();
    return (
      <Sidebar.Item icon={<Palette />} to="/settings/appearance">
        {t('feature.themeToggle.title')}
      </Sidebar.Item>
    );
  },
});
