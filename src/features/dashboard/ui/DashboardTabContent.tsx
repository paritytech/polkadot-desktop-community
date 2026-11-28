import { TabChip } from '@/shared/components';
import { HouseIcon } from '@/shared/icons';
import { useTranslation } from '@/shared/translation';

type Props = { isActive: boolean };

export const DashboardTabContent = ({ isActive }: Props) => {
  const { t } = useTranslation();
  return <TabChip icon={<HouseIcon />} isActive={isActive} label={t('feature.dashboard.title')} />;
};
