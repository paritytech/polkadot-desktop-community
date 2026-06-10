import { CodeXml } from 'lucide-react';

import { Sidebar } from '@/shared/components';
import { createFeature } from '@/shared/feature';
import { useTranslation } from '@/shared/translation';
import { settingsDevelopmentNavSlot } from '@/features/settings';

export const statementStoreNetworkFeature = createFeature({
  name: 'statement-store/test-network-select',
});

statementStoreNetworkFeature.inject(settingsDevelopmentNavSlot, {
  order: -1,
  render: () => {
    const { t } = useTranslation();

    return (
      <Sidebar.Item icon={<CodeXml />} to="/settings/development/network">
        {t('feature.statementStoreNetwork.title')}
      </Sidebar.Item>
    );
  },
});
