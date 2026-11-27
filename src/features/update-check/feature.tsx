import RefreshCwIcon from '@/shared/assets/images/icons/refresh-cw.svg?jsx';
import { Sidebar } from '@/shared/components';
import { createFeature } from '@/shared/feature';
import { useTranslation } from '@/shared/translation';
import { settingsDevelopmentNavSlot } from '@/features/settings';

export const updateCheckFeature = createFeature({
  name: 'app/update-check',
});

updateCheckFeature.inject(settingsDevelopmentNavSlot, {
  order: 0,
  render: () => {
    const { t } = useTranslation();

    return (
      <Sidebar.Item icon={<RefreshCwIcon />} to="/settings/development/update-channel">
        {t('feature.updateCheck.channel.title')}
      </Sidebar.Item>
    );
  },
});
