import ShieldIcon from '@/shared/assets/images/icons/shield.svg?jsx';
import { Sidebar } from '@/shared/components';
import { createFeature } from '@/shared/feature';
import { useTranslation } from '@/shared/translation';
import { settingsPrivacyNavSlot } from '@/features/settings';

export const permissionSettingsFeature = createFeature({
  name: 'settings/permissions',
});

const PermissionsNavItem = () => {
  const { t } = useTranslation();
  return (
    <Sidebar.Item icon={<ShieldIcon className="size-4" />} to="/settings/privacy/permissions">
      {t('feature.permissionSettings.navItem')}
    </Sidebar.Item>
  );
};

permissionSettingsFeature.inject(settingsPrivacyNavSlot, {
  order: 1,
  render: () => <PermissionsNavItem />,
});
