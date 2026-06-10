import HomeIcon from '@/shared/assets/images/header/home.svg?jsx';
import { TabChip, tabIconClassName } from '@/shared/components';
import { useTranslation } from '@/shared/translation';

type Props = { isActive: boolean };

export const DashboardTabContent = ({ isActive }: Props) => {
  const { t } = useTranslation();
  return (
    <TabChip
      icon={<HomeIcon className={tabIconClassName} aria-hidden />}
      isActive={isActive}
      label={t('feature.dashboard.title')}
    />
  );
};
