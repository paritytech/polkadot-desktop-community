import SettingsIcon from '@/shared/assets/images/icons/settings.svg?jsx';
import { TabChip } from '@/shared/components';
import { useTranslation } from '@/shared/translation';

type Props = { isActive: boolean };

export const SettingsTabContent = ({ isActive }: Props) => {
  const { t } = useTranslation();
  return <TabChip icon={<SettingsIcon />} isActive={isActive} label={t('feature.settings.title')} />;
};
