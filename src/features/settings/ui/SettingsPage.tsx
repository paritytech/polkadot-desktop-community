import { AppIcon } from '@novasamatech/tr-ui';
import { Outlet } from '@tanstack/react-router';
import { memo } from 'react';

import SettingsIcon from '@/shared/assets/images/header/cog-8-tooth.svg?jsx';
import { SettingsHeader, Sidebar, widgetSpanWidthCss } from '@/shared/components';
import { Slot } from '@/shared/di';
import { isProductionBuild } from '@/shared/env';
import { useTranslation } from '@/shared/translation';
import { useSettingsHistoryTracker } from '../hooks/useSettingsHistoryTracker';
import { settingsDevelopmentNavSlot, settingsPreferencesNavSlot, settingsPrivacyNavSlot } from '../slots';

// Match the side menu to a single widget column so it resizes in the same proportions as widgets.
const sideMenuStyle = { width: widgetSpanWidthCss(1) };

export const SettingsPage = memo(() => {
  const { t } = useTranslation();
  useSettingsHistoryTracker();

  return (
    <div className="flex size-full h-full gap-2 p-2">
      <aside style={sideMenuStyle} className="flex shrink-0 flex-col overflow-hidden rounded-xl bg-bg-surface-container">
        <SettingsHeader
          icon={
            <AppIcon size="sm" alt="">
              <SettingsIcon className="size-4" />
            </AppIcon>
          }
        >
          {t('feature.settings.title')}
        </SettingsHeader>
        <div className="min-h-0 flex-1 gap-4 p-2">
          <Sidebar.Group title={t('feature.settings.group.preferences')}>
            <Slot id={settingsPreferencesNavSlot} />
          </Sidebar.Group>
          <Sidebar.Group title={t('feature.settings.group.privacy')}>
            <Slot id={settingsPrivacyNavSlot} />
          </Sidebar.Group>
          {!isProductionBuild() && (
            <Sidebar.Group title={t('feature.settings.group.development')}>
              <Slot id={settingsDevelopmentNavSlot} />
            </Sidebar.Group>
          )}
        </div>
      </aside>
      <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden rounded-xl bg-bg-surface-container">
        <Outlet />
      </div>
    </div>
  );
});

SettingsPage.displayName = 'SettingsPage';
