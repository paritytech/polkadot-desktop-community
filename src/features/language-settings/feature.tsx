import { Sidebar } from '@/shared/components';
import { createFeature } from '@/shared/feature';
import { LanguagesIcon } from '@/shared/icons';
import { useTranslation } from '@/shared/translation';
import { settingsPreferencesNavSlot } from '@/features/settings';

export const languageSettingsFeature = createFeature({
  name: 'settings/language',
});

// `-1`, not `0`: `feature.inject` registers at module-eval time and `src/index.tsx`
// statically imports theme-toggle, so at an equal order Appearance would always win
// the tie and render above Language.
languageSettingsFeature.inject(settingsPreferencesNavSlot, {
  order: -1,
  render: () => {
    const { t } = useTranslation();

    return (
      <Sidebar.Item icon={<LanguagesIcon />} to="/settings/language">
        {t('feature.languageSettings.title')}
      </Sidebar.Item>
    );
  },
});
