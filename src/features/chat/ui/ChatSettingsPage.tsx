import { ListItem, SettingsList, SettingsSection, Switch } from '@/shared/components';
import { useTranslation } from '@/shared/translation';
import { useHideRequestsByDefault, useSetHideRequestsByDefault } from '@/domains/chat';

export const ChatSettingsPage = () => {
  const { t } = useTranslation();
  const { data: hideByDefault } = useHideRequestsByDefault();
  const { run: setHideByDefault } = useSetHideRequestsByDefault();

  return (
    <SettingsList title={t('feature.chat.settings.title')} subtitle={t('feature.chat.settings.subtitle')}>
      <SettingsSection title={t('feature.chat.settings.messageRequestsSection')} layout="list">
        <ListItem
          label={t('feature.chat.settings.hideByDefault')}
          description={t('feature.chat.settings.hideByDefaultHint')}
          title={t('feature.chat.settings.hideByDefaultHint')}
          action={
            <Switch
              checked={hideByDefault}
              label={t('feature.chat.settings.hideByDefault')}
              onCheckedChange={value => setHideByDefault({ value })}
            />
          }
        />
      </SettingsSection>
    </SettingsList>
  );
};
