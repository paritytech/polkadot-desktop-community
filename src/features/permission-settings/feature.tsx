import { Shield } from 'lucide-react';

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
    <Sidebar.Item icon={<Shield size={16} />} to="/settings/privacy/permissions">
      {t('feature.permissionSettings.navItem')}
    </Sidebar.Item>
  );
};

permissionSettingsFeature.inject(settingsPrivacyNavSlot, {
  order: 1,
  render: () => <PermissionsNavItem />,
});
