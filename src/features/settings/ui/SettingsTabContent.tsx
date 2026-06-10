import SettingsIcon from '@/shared/assets/images/header/cog-8-tooth.svg?jsx';
import { TabChip, tabIconClassName } from '@/shared/components';
import { useTranslation } from '@/shared/translation';

type Props = { isActive: boolean };

export const SettingsTabContent = ({ isActive }: Props) => {
  const { t } = useTranslation();
  return (
    <TabChip
      icon={<SettingsIcon className={tabIconClassName} aria-hidden />}
      isActive={isActive}
      label={t('feature.settings.title')}
    />
  );
};
