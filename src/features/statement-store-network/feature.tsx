import { Sidebar } from '@/shared/components';
import { createFeature } from '@/shared/feature';
import { CodeXmlIcon } from '@/shared/icons';
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
      <Sidebar.Item icon={<CodeXmlIcon />} to="/settings/development/network">
        {t('feature.statementStoreNetwork.title')}
      </Sidebar.Item>
    );
  },
});
