import { memo, useState } from 'react';

import { Select, SettingsList, SettingsSection } from '@/shared/components';
import { reloadApp } from '@/shared/env';
import { useRxState } from '@/shared/rxstate';
import { useTranslation } from '@/shared/translation';
import { type EnvironmentId, environmentService } from '@/domains/application';
import { networkSettings } from '@/aggregates/network-settings';
import { truapiRuntimeUseCase, useTruapiSession } from '@/aggregates/truapi-runtime';

import { NetworkChangeLogoutDialog } from './NetworkChangeLogoutDialog';

export const TestnetSettings = memo(() => {
  const { t } = useTranslation();
  const session = useTruapiSession();
  const [settings] = useRxState(networkSettings.settings$);
  const [pendingEnvironment, setPendingEnvironment] = useState<EnvironmentId | null>(null);

  const applyEnvironmentChange = (value: EnvironmentId) => {
    networkSettings.setValue('environmentId', value);

    if (!session) {
      reloadApp();
      return;
    }

    // The core drops the session whether or not the wallet could be notified, so
    // `watchCoreSessionTeardown` always runs the full logout + reload, which boots
    // into the just-persisted environment.
    truapiRuntimeUseCase.disconnectSession().catch((error: unknown) => {
      console.error('[sso] network-switch disconnect failed', error);
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
        <Select.Root value={settings.environmentId} onValueChange={handleSelectChange}>
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
        </Select.Root>
      </SettingsSection>

      <NetworkChangeLogoutDialog
        open={pendingEnvironment !== null}
        onConfirm={handleNetworkChangeConfirm}
        onCancel={handleNetworkChangeCancel}
      />
    </SettingsList>
  );
});
