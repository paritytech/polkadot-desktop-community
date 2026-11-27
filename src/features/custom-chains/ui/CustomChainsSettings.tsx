import { memo, useId, useState } from 'react';
import { firstValueFrom } from 'rxjs';
import * as v from 'valibot';

import TrashIcon from '@/shared/assets/images/icons/trash.svg?jsx';
import { Button, IconButton, Input, Label, ListItem, SettingsList, SettingsSection, toast } from '@/shared/components';
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
  const endpointId = useId();
  const nameId = useId();

  const canSubmit = !addChain.pending && endpoint.trim().length > 0;

  const handleAdd = async () => {
    const trimmedEndpoint = endpoint.trim();
    if (!isValidWsUrl(trimmedEndpoint)) {
      toast.error({
        title: t('feature.customChains.errors.invalidUrlTitle'),
        description: t('feature.customChains.errors.invalidUrlDescription'),
      });
      return;
    }

    const result = await firstValueFrom(addChain.run({ endpoint: trimmedEndpoint, name }));

    switch (result.status) {
      case 'duplicate-builtin':
        toast.error({
          title: t('feature.customChains.errors.duplicateBuiltinTitle'),
          description: t('feature.customChains.errors.duplicateBuiltinDescription'),
        });
        return;
      case 'duplicate-custom':
        toast.error({
          title: t('feature.customChains.errors.duplicateCustomTitle'),
          description: t('feature.customChains.errors.duplicateCustomDescription'),
        });
        return;
      case 'failed':
        toast.error({
          title: t('feature.customChains.errors.connectionFailedTitle'),
          description: result.message || t('feature.customChains.errors.unknownError'),
        });
        return;
      case 'added':
        toast.success({
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
              <Label htmlFor={endpointId}>{t('feature.customChains.endpointLabel')}</Label>
              <Input
                id={endpointId}
                data-testid={TEST_IDS.customChainsEndpointInput}
                disabled={addChain.pending}
                value={endpoint}
                placeholder={t('feature.customChains.endpointPlaceholder')}
                onChange={e => setEndpoint(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={nameId}>{t('feature.customChains.nameLabel')}</Label>
              <Input
                id={nameId}
                data-testid={TEST_IDS.customChainsNameInput}
                disabled={addChain.pending}
                value={name}
                placeholder={t('feature.customChains.namePlaceholder')}
                onChange={e => setName(e.target.value)}
              />
            </div>
            <Button variant="primary" data-testid={TEST_IDS.customChainsAddButton} disabled={!canSubmit} onClick={handleAdd}>
              {addChain.pending ? t('feature.customChains.addingButton') : t('feature.customChains.addButton')}
            </Button>
          </div>
        </SettingsSection>

        {entryList.length > 0 && (
          <SettingsSection title={t('feature.customChains.registeredSection')} layout="list">
            {entryList.map(([hash, entry]) => (
              <ListItem
                key={hash}
                testId={TEST_IDS.customChainsEntry}
                label={entry.name}
                description={
                  <>
                    <span>{entry.endpoints[0]}</span>
                    {/* eslint-disable-next-line formatjs/no-literal-string-in-jsx */}
                    <span className="font-mono">{hash.slice(0, 18)}…</span>
                  </>
                }
                action={
                  <IconButton
                    data-testid={TEST_IDS.customChainsRemoveButton}
                    label={t('feature.customChains.removeChainAriaLabel', { name: entry.name })}
                    onClick={() => remove.run({ chainId: v.parse(genesisHash, hash) })}
                  >
                    <TrashIcon />
                  </IconButton>
                }
              />
            ))}
          </SettingsSection>
        )}

        {entryList.length === 0 && <p className="text-center text-xs text-fg-tertiary">{t('feature.customChains.emptyState')}</p>}
      </div>
    </SettingsList>
  );
});
