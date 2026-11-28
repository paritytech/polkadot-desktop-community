import { TabChip } from '@/shared/components';
import { SettingsIcon16 } from '@/shared/icons';
import { useTranslation } from '@/shared/translation';

type Props = { isActive: boolean };

export const SettingsTabContent = ({ isActive }: Props) => {
  const { t } = useTranslation();
  return <TabChip icon={<SettingsIcon16 />} isActive={isActive} label={t('feature.settings.title')} />;
};
