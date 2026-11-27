import HouseIcon from '@/shared/assets/images/icons/house.svg?jsx';
import { TabChip } from '@/shared/components';
import { useTranslation } from '@/shared/translation';

type Props = { isActive: boolean };

export const DashboardTabContent = ({ isActive }: Props) => {
  const { t } = useTranslation();
  return <TabChip icon={<HouseIcon />} isActive={isActive} label={t('feature.dashboard.title')} />;
};
