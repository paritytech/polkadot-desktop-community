import PlaceholderIcon from '@/shared/assets/images/header/placeholder.svg?jsx';
import { TabChip, tabIconClassName } from '@/shared/components';
import { useTranslation } from '@/shared/translation';

type Props = { isActive: boolean };

export const NewTabContent = ({ isActive }: Props) => {
  const { t } = useTranslation();
  return (
    <TabChip
      placeholder={<PlaceholderIcon className={tabIconClassName} aria-hidden />}
      isActive={isActive}
      label={t('feature.browser.newTab')}
    />
  );
};
