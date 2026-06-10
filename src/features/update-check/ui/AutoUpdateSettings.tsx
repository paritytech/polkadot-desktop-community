import { Button, Select } from '@novasamatech/tr-ui';
import { memo, useEffect, useState } from 'react';

import { Box, SettingsList, SettingsSection } from '@/shared/components';
import { useTranslation } from '@/shared/translation';

import { useUpdateCheck } from './UpdateCheckContext';

type UpdateChannel = 'stable' | 'experimental';
const CHANNEL_STORE_KEY = 'updateChannel';
const DEFAULT_CHANNEL: UpdateChannel = 'stable';

const normalizeChannel = (raw: unknown): UpdateChannel => (raw === 'experimental' ? 'experimental' : 'stable');

export const AutoUpdateSettings = memo(() => {
  const { t } = useTranslation();
  const { openUpdateCheck } = useUpdateCheck();
  const [channel, setChannel] = useState<UpdateChannel>(DEFAULT_CHANNEL);

  useEffect(() => {
    if (!window.App?.getStoreValue) return;
    let cancelled = false;
    window.App.getStoreValue(CHANNEL_STORE_KEY).then(value => {
      if (!cancelled) setChannel(normalizeChannel(value));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const isSupported = window.App?.isAutoUpdateSupported;

  const handleChannelChange = (raw: string) => {
    const next = normalizeChannel(raw);
    if (next === channel) return;
    setChannel(next);
    window.App?.setStoreValue(CHANNEL_STORE_KEY, next);
  };

  return (
    <SettingsList title={t('feature.updateCheck.channel.title')}>
      <SettingsSection>
        <Box gap={3}>
          <Box gap={1}>
            <Select value={channel} onValueChange={handleChannelChange}>
              <Select.Trigger>
                <Select.Value />
              </Select.Trigger>
              <Select.Content>
                <Select.Item value="stable">{t('feature.updateCheck.channel.stable')}</Select.Item>
                <Select.Item value="experimental">{t('feature.updateCheck.channel.experimental')}</Select.Item>
              </Select.Content>
            </Select>
            <span className="text-xs text-text-secondary">
              {channel === 'experimental'
                ? t('feature.updateCheck.channel.experimentalHint')
                : t('feature.updateCheck.channel.stableHint')}
            </span>
          </Box>
          {isSupported && (
            <Button variant="outline" size="sm" onClick={openUpdateCheck}>
              {t('feature.updateCheck.checkForUpdates')}
            </Button>
          )}
        </Box>
      </SettingsSection>
    </SettingsList>
  );
});

AutoUpdateSettings.displayName = 'AutoUpdateSettings';
