import { Button, Input, Label, toastError, toastSuccess } from '@novasamatech/tr-ui';
import { Trash2 } from 'lucide-react';
import { memo, useState } from 'react';
import { firstValueFrom } from 'rxjs';
import * as v from 'valibot';

import { SettingsList, SettingsSection } from '@/shared/components';
import { TEST_IDS } from '@/shared/test-ids';
import { useTranslation } from '@/shared/translation';
import { genesisHash, useCustomChains, useDiscoverAndAddChain, useRemoveCustomChain } from '@/domains/network';

const isValidWsUrl = (url: string) => {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'ws:' || parsed.protocol === 'wss:';
  } catch {
    return false;
  }
};

export const CustomChainsSettings = memo(() => {
  const { t } = useTranslation();
  const { data: entries } = useCustomChains();
  const addChain = useDiscoverAndAddChain();
  const remove = useRemoveCustomChain();
  const [endpoint, setEndpoint] = useState('');
  const [name, setName] = useState('');

  const canSubmit = !addChain.pending && endpoint.trim().length > 0;

  const handleAdd = async () => {
    const trimmedEndpoint = endpoint.trim();
    if (!isValidWsUrl(trimmedEndpoint)) {
      toastError({
        title: t('feature.customChains.errors.invalidUrlTitle'),
        description: t('feature.customChains.errors.invalidUrlDescription'),
      });
      return;
    }

    const result = await firstValueFrom(addChain.run({ endpoint: trimmedEndpoint, name }));

    switch (result.status) {
      case 'duplicate-builtin':
        toastError({
          title: t('feature.customChains.errors.duplicateBuiltinTitle'),
          description: t('feature.customChains.errors.duplicateBuiltinDescription'),
        });
        return;
      case 'duplicate-custom':
        toastError({
          title: t('feature.customChains.errors.duplicateCustomTitle'),
          description: t('feature.customChains.errors.duplicateCustomDescription'),
        });
        return;
      case 'failed':
        toastError({
          title: t('feature.customChains.errors.connectionFailedTitle'),
          description: result.message || t('feature.customChains.errors.unknownError'),
        });
        return;
      case 'added':
        toastSuccess({
          title: t('feature.customChains.addedToastTitle'),
          description: t('feature.customChains.addedToastDescription', {
            name: result.name,
            genesisHash: `${result.genesisHash.slice(0, 10)}…`,
          }),
        });
        setEndpoint('');
        setName('');
    }
  };

  const entryList = Object.entries(entries);

  return (
    <SettingsList title={t('feature.customChains.title')}>
      <div className="flex flex-col gap-4">
        <SettingsSection title={t('feature.customChains.addSection')}>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              <Label>{t('feature.customChains.endpointLabel')}</Label>
              <Input
                data-testid={TEST_IDS.customChainsEndpointInput}
                disabled={addChain.pending}
                value={endpoint}
                placeholder={t('feature.customChains.endpointPlaceholder')}
                onChange={e => setEndpoint(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>{t('feature.customChains.nameLabel')}</Label>
              <Input
                data-testid={TEST_IDS.customChainsNameInput}
                disabled={addChain.pending}
                value={name}
                placeholder={t('feature.customChains.namePlaceholder')}
                onChange={e => setName(e.target.value)}
              />
            </div>
            <Button data-testid={TEST_IDS.customChainsAddButton} disabled={!canSubmit} onClick={handleAdd}>
              {addChain.pending ? t('feature.customChains.addingButton') : t('feature.customChains.addButton')}
            </Button>
          </div>
        </SettingsSection>

        {entryList.length > 0 && (
          <SettingsSection title={t('feature.customChains.registeredSection')}>
            <div className="flex flex-col gap-2">
              {entryList.map(([hash, entry]) => (
                <div
                  key={hash}
                  data-testid={TEST_IDS.customChainsEntry}
                  className="flex items-center justify-between gap-2 rounded-md border border-general-border p-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-text-primary">{entry.name}</div>
                    <div className="truncate text-xs text-text-tertiary">{entry.endpoints[0]}</div>
                    <div className="truncate font-mono text-xs text-text-tertiary">{hash.slice(0, 18)}…</div>
                  </div>
                  <Button
                    data-testid={TEST_IDS.customChainsRemoveButton}
                    aria-label={t('feature.customChains.removeChainAriaLabel', { name: entry.name })}
                    size="icon"
                    variant="ghost"
                    onClick={() => remove.run({ chainId: v.parse(genesisHash, hash) })}
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              ))}
            </div>
          </SettingsSection>
        )}

        {entryList.length === 0 && (
          <p className="text-center text-sm text-text-tertiary">{t('feature.customChains.emptyState')}</p>
        )}
      </div>
    </SettingsList>
  );
});
