import { Button, ProductLoadingPhrase } from '@/shared/components';
import { TEST_IDS } from '@/shared/test-ids';
import { useTranslation } from '@/shared/translation';
import { useConnectionSettings, useSetConnectionPreference } from '@/domains/network';
import { onProductRefreshRequestedSideEffect } from '@/aggregates/product-loading';
import { type ProductLoadPhase } from '../hooks/useProductLoadPhase';

type Props = { identifier: string; phase: ProductLoadPhase };

/**
 * The switch is offered only while the preference is the light client: on RPC a
 * slow load has nothing to do with the connection mode, so the slow state has
 * nothing to say and falls back to the plain phrase.
 */
export const ProductLoadNotice = ({ identifier, phase }: Props) => {
  const { t } = useTranslation();
  const { data: settings } = useConnectionSettings();
  const setPreference = useSetConnectionPreference();

  const canSwitch = settings.preference === 'light-client';

  const handleReload = () => {
    void onProductRefreshRequestedSideEffect.apply({ identifier });
  };

  // The open connections are moved onto the RPC nodes in place, so the load the
  // user is waiting on carries on rather than starting over after a restart.
  const handleSwitch = () => {
    setPreference.run({ preference: 'rpc' });
  };

  if (phase === 'loading' || (phase === 'slow' && !canSwitch)) {
    return <ProductLoadingPhrase identifier={identifier} />;
  }

  const failed = phase === 'timeout';

  let description = t('feature.networkConnection.slowLoad.description');
  if (failed) {
    description = canSwitch
      ? t('feature.networkConnection.loadFailed.description')
      : t('feature.networkConnection.loadFailed.descriptionReloadOnly');
  }

  return (
    <div data-testid={TEST_IDS.productLoadNotice} className="flex w-full flex-col items-center gap-3 px-4">
      <div className="flex flex-col items-center gap-1">
        <p className="text-sm leading-5 font-semibold text-fg-primary">
          {failed ? t('feature.networkConnection.loadFailed.title') : t('feature.networkConnection.slowLoad.title')}
        </p>
        <p className="text-center text-xs leading-4 font-medium text-fg-tertiary">{description}</p>
      </div>
      <div className="flex items-start gap-3">
        {failed && (
          <Button data-testid={TEST_IDS.productLoadReloadButton} size="sm" onClick={handleReload}>
            {t('feature.networkConnection.loadFailed.reload')}
          </Button>
        )}
        {canSwitch && (
          <Button variant="primary" data-testid={TEST_IDS.productLoadSwitchButton} size="sm" onClick={handleSwitch}>
            {t('feature.networkConnection.slowLoad.action')}
          </Button>
        )}
      </div>
    </div>
  );
};
