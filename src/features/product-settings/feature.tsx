import Grid2x2Icon from '@/shared/assets/images/icons/grid-2x2.svg?jsx';
import { Sidebar } from '@/shared/components';
import { createFeature } from '@/shared/feature';
import { useTranslation } from '@/shared/translation';
import { settingsPrivacyNavSlot } from '@/features/settings';

export const productSettingsFeature = createFeature({
  name: 'product/settings',
});

productSettingsFeature.inject(settingsPrivacyNavSlot, {
  order: 2,
  render: () => {
    const { t } = useTranslation();

    return (
      <Sidebar.Item icon={<Grid2x2Icon />} to="/settings/privacy/apps">
        {t('feature.productSettings.title')}
      </Sidebar.Item>
    );
  },
});
