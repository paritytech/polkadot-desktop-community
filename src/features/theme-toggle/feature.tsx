import { Sidebar } from '@/shared/components';
import { createFeature } from '@/shared/feature';
import { PaletteIcon } from '@/shared/icons';
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
      <Sidebar.Item icon={<PaletteIcon />} to="/settings/appearance">
        {t('feature.themeToggle.title')}
      </Sidebar.Item>
    );
  },
});
