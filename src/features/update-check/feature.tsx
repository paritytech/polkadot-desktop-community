import { RefreshCw } from 'lucide-react';

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
      <Sidebar.Item icon={<RefreshCw />} to="/settings/development/update-channel">
        {t('feature.updateCheck.channel.title')}
      </Sidebar.Item>
    );
  },
});
