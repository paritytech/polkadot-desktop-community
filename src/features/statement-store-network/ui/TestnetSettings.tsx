import { useAuthentication, useSession } from '@novasamatech/host-papp-react-ui';
import { Select } from '@novasamatech/tr-ui';
import { memo, useState } from 'react';

import { SettingsList, SettingsSection } from '@/shared/components';
import { reloadApp } from '@/shared/env';
import { useRxState } from '@/shared/rxstate';
import { useTranslation } from '@/shared/translation';
import { type EnvironmentId, environmentService, performUserLogout } from '@/domains/application';
import { networkSettings } from '@/aggregates/network-settings';

import { NetworkChangeLogoutDialog } from './NetworkChangeLogoutDialog';

export const TestnetSettings = memo(() => {
  const { t } = useTranslation();
  const auth = useAuthentication();
  const { session } = useSession();
  const [settings] = useRxState(networkSettings.settings$);
  const [pendingEnvironment, setPendingEnvironment] = useState<EnvironmentId | null>(null);

  const applyEnvironmentChange = (value: EnvironmentId) => {
    networkSettings.setValue('environmentId', value);

    if (!session) {
      reloadApp();
      return;
    }

    // On success the session-teardown watcher runs the full logout + reload,
    // which boots into the just-persisted environment. host-papp only removes the
    // session when the `Disconnected` send succeeds, so if it fails (offline) the
    // watcher never fires — tear down locally anyway so the switch always reloads.
    auth.disconnect(session).catch((error: unknown) => {
      console.warn('[sso] network-switch disconnect failed; tearing down locally anyway', error);
      void performUserLogout();
    });
  };

  const handleSelectChange = (raw: string) => {
    if (!environmentService.isEnvironmentId(raw)) return;

    if (raw === settings.environmentId) return;

    if (session) {
      setPendingEnvironment(raw);
      return;
    }

    applyEnvironmentChange(raw);
  };

  const handleNetworkChangeConfirm = () => {
    if (pendingEnvironment === null) return;

    const value = pendingEnvironment;
    setPendingEnvironment(null);
    applyEnvironmentChange(value);
  };

  const handleNetworkChangeCancel = () => {
    setPendingEnvironment(null);
  };

  return (
    <SettingsList title={t('feature.statementStoreNetwork.title')}>
      <SettingsSection>
        <Select value={settings.environmentId} onValueChange={handleSelectChange}>
          <Select.Trigger>
            <Select.Value />
          </Select.Trigger>
          <Select.Content>
            {environmentService.list().map(env => (
              <Select.Item key={env.id} value={env.id}>
                {env.name}
              </Select.Item>
            ))}
          </Select.Content>
        </Select>
      </SettingsSection>

      <NetworkChangeLogoutDialog
        open={pendingEnvironment !== null}
        onConfirm={handleNetworkChangeConfirm}
        onCancel={handleNetworkChangeCancel}
      />
    </SettingsList>
  );
});
