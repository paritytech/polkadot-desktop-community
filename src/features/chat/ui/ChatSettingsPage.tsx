import { SettingsList, SettingsSection, Switch } from '@/shared/components';
import { useTranslation } from '@/shared/translation';
import { useHideRequestsByDefault, useSetHideRequestsByDefault } from '@/domains/chat';

export const ChatSettingsPage = () => {
  const { t } = useTranslation();
  const { data: hideByDefault } = useHideRequestsByDefault();
  const { run: setHideByDefault } = useSetHideRequestsByDefault();

  return (
    <SettingsList title={t('feature.chat.settings.title')} subtitle={t('feature.chat.settings.subtitle')}>
      <SettingsSection title={t('feature.chat.settings.messageRequestsSection')}>
        <div className="flex items-center gap-4">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-sm font-medium text-fg-primary">{t('feature.chat.settings.hideByDefault')}</span>
            <span className="text-sm text-fg-secondary">{t('feature.chat.settings.hideByDefaultHint')}</span>
          </div>
          <Switch
            checked={hideByDefault}
            label={t('feature.chat.settings.hideByDefault')}
            onCheckedChange={value => setHideByDefault({ value })}
          />
        </div>
      </SettingsSection>
    </SettingsList>
  );
};
