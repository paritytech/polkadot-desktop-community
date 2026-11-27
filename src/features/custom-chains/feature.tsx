import Link2Icon from '@/shared/assets/images/icons/link-2.svg?jsx';
import { Sidebar } from '@/shared/components';
import { createFeature } from '@/shared/feature';
import { useTranslation } from '@/shared/translation';
import { settingsDevelopmentNavSlot } from '@/features/settings';

export const customChainsFeature = createFeature({
  name: 'network/custom-chains',
});

customChainsFeature.inject(settingsDevelopmentNavSlot, {
  order: 0,
  render: () => {
    const { t } = useTranslation();

    return (
      <Sidebar.Item icon={<Link2Icon />} to="/settings/development/custom-chains">
        {t('feature.customChains.title')}
      </Sidebar.Item>
    );
  },
});
