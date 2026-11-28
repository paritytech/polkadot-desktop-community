import { TabChip } from '@/shared/components';
import { HouseIcon16 } from '@/shared/icons';
import { useTranslation } from '@/shared/translation';

type Props = { isActive: boolean };

export const DashboardTabContent = ({ isActive }: Props) => {
  const { t } = useTranslation();
  return <TabChip icon={<HouseIcon16 />} isActive={isActive} label={t('feature.dashboard.title')} />;
};
