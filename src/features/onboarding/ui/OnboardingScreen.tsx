import { useNavigate } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useState } from 'react';

import LoaderIcon from '@/shared/assets/images/icons/loader.svg?jsx';
import SmartphoneIcon from '@/shared/assets/images/icons/smartphone.svg?jsx';
import PolkadotLogo from '@/shared/assets/images/logo.svg?jsx';
import { AUTOTEST_ENABLED } from '@/shared/autotest';
import { Button, LoadingScreen, QrCode, SegmentedControl, Spinner, toast } from '@/shared/components';
import { isProductionBuild, reloadApp } from '@/shared/env';
import { useRxState } from '@/shared/rxstate';
import { TEST_IDS } from '@/shared/test-ids';
import { useTranslation } from '@/shared/translation';
import { type EnvironmentId, environmentService, useThemeVariant } from '@/domains/application';
import { networkSettings } from '@/aggregates/network-settings';
import { truapiRuntimeUseCase, useTruapiAuthState } from '@/aggregates/truapi-runtime';
import { useOnboardingConnection } from '../hooks/useOnboardingConnection';

import { OnboardingConnectionPanel } from './OnboardingConnectionPanel';

const QR_SIZE = 362;

export const OnboardingScreen = () => {
  const { t } = useTranslation();
  const [settings] = useRxState(networkSettings.settings$);

  const mode = useThemeVariant();

  const navigate = useNavigate();

  const authState = useTruapiAuthState();
  const connectionState = useOnboardingConnection();

  // `sawPairing` tells a real new pairing (which reaches `Pairing`) from the silent boot
  // reconnect of an already-paired session, so only the latter is hidden below.
  const [sawPairing, setSawPairing] = useState(false);
  useEffect(() => {
    if (authState?.tag === 'Pairing') setSawPairing(true);
  }, [authState?.tag]);

  // The core owns the session, so pairing starts by asking it to. Only from
  // `Disconnected` — asking again while a pairing is already live would strand
  // the deeplink the user is looking at.
  useEffect(() => {
    if (authState?.tag !== 'Disconnected') return;

    void truapiRuntimeUseCase.requestLogin().catch((error: unknown) => {
      console.error('[truapi] login request failed', error);
    });
  }, [authState?.tag]);

  useEffect(() => {
    if (authState?.tag === 'Connected') {
      navigate({ to: '/dashboard' });
    }
  }, [authState?.tag, navigate]);

  const hasError = authState?.tag === 'LoginFailed';

  // The wallet sends failure reasons as free-form strings; classify the ones we
  // want specialised UX for. Everything else falls back to the verbatim reason.
  const errorContent = useMemo(() => {
    if (authState?.tag !== 'LoginFailed') return null;
    const reason = authState.value.reason;
    if (/no\s+free.*slot|slot.*available|limit\s*=/i.test(reason)) {
      return {
        kind: 'noFreeSlots' as const,
        title: t('feature.onboarding.errorNoFreeSlotsTitle'),
        description: t('feature.onboarding.errorNoFreeSlotsDescription'),
      };
    }
    return {
      kind: 'generic' as const,
      title: t('feature.onboarding.errorTitle'),
      description: reason || t('feature.onboarding.error'),
    };
  }, [authState, t]);

  useEffect(() => {
    // Only toast generic pairing errors. Recognized states (e.g. account setup)
    // are surfaced by the connection panel, so suppress the toast unless we are
    // deferring to the plain pairing flow.
    if (hasError && errorContent && errorContent.kind !== 'noFreeSlots' && connectionState === 'pairing') {
      toast.error({ title: errorContent.title });
    }
  }, [hasError, errorContent, connectionState]);

  // The core emits the deeplink only while it is scannable: `Pairing` is left as
  // soon as the wallet answers, so there is no separate "still showing a stale
  // QR" case to exclude here.
  const qrPayload = authState?.tag === 'Pairing' ? authState.value.deeplink : null;
  const showQR = qrPayload !== null;
  const showHandshakeProgress = authState?.tag === 'Authenticating';
  // Lock the network switcher only while the pairing flow is mid-handshake (QR
  // not yet shown, no error). During connection states, or once the QR/error is
  // visible, the user may switch networks.
  const isNetworkSelectionDisabled = connectionState === 'pairing' && !showQR && !hasError;

  // The core owns the device identity and mints fresh pairing material per
  // attempt, so a retry is just another login — no identity reset, no reload.
  const handleRetry = useCallback(() => {
    void truapiRuntimeUseCase.requestLogin().catch((error: unknown) => {
      console.error('[truapi] login retry failed', error);
    });
  }, []);

  const handleEnvironmentChange = (value: EnvironmentId) => {
    if (value === settings.environmentId) return;

    networkSettings.setValue('environmentId', value);
    reloadApp();
  };

  const environments = environmentService.list();

  // Hide the login chrome behind the loading screen through the silent boot reconnect, so
  // an already-paired user never sees it flash on restart.
  const isBootReconnecting =
    connectionState === 'pairing' &&
    !sawPairing &&
    !hasError &&
    (authState === null || authState.tag === 'Disconnected' || authState.tag === 'Authenticating');
  if (isBootReconnecting) {
    return <LoadingScreen />;
  }

  // What fills the QR box, in priority order: a connection state preempts the
  // pairing flow; otherwise show the QR, the in-flight handshake spinner, the
  // error, or the loading spinner.
  const renderQrBoxContent = () => {
    if (connectionState !== 'pairing') {
      return <OnboardingConnectionPanel state={connectionState} onRetry={handleRetry} />;
    }
    if (showQR && qrPayload !== null) {
      return <QrCode value={qrPayload} size={QR_SIZE} theme={mode} />;
    }
    if (showHandshakeProgress) {
      return (
        <div
          data-testid={TEST_IDS.onboardingCompletingPairing}
          className="flex h-full w-full flex-col items-center justify-center gap-8 text-fg-primary"
        >
          <Spinner size={120} />
          <p className="text-center text-base font-medium text-fg-secondary">{t('feature.onboarding.completingPairing')}</p>
        </div>
      );
    }
    if (hasError && errorContent) {
      return (
        <div
          data-testid={TEST_IDS.onboardingPairingError}
          data-error-kind={errorContent.kind}
          className="flex h-full w-full flex-col items-center justify-center gap-4 p-8"
        >
          <p className="text-center text-base font-medium text-fg-primary">{errorContent.title}</p>
          <p className="text-center text-sm text-fg-secondary">{errorContent.description}</p>
          <Button variant="primary" type="button" size="sm" onClick={handleRetry}>
            {t('common.action.retry')}
          </Button>
        </div>
      );
    }
    return <LoaderIcon className="h-12 w-12 animate-spin text-fg-primary" />;
  };

  return (
    <div
      className="flex min-h-screen w-screen flex-col items-center justify-center overflow-y-auto bg-bg-surface-nested pt-6 pb-2"
      style={{ appRegion: 'drag' }}
    >
      <div
        className="flex flex-col items-center gap-4 px-6 xl:flex-row xl:items-center xl:gap-16"
        style={{ appRegion: 'no-drag' }}
      >
        <div className="flex w-full max-w-172 flex-col items-start gap-3 xl:w-172">
          <div className="flex items-center gap-5">
            <PolkadotLogo className="origin-right" />
            <div className="h-8.5 w-px bg-fg-primary" />
            <div className="text-sm font-semibold tracking-[0.5px] text-fg-primary uppercase">
              {t('feature.onboarding.logoText')}
            </div>
          </div>
          <h1 className="text-3xl font-semibold tracking-[-0.32px] text-fg-primary xl:text-4xl xl:tracking-[-0.48px]">
            {t('feature.onboarding.mainText')}
          </h1>
          <p className="w-full max-w-172 text-center text-base font-medium text-fg-secondary xl:text-start">
            {t('feature.onboarding.description')}
          </p>
        </div>

        <div className="flex w-full max-w-100.5 flex-col items-center gap-2">
          {!isProductionBuild() && environments.length > 1 && (
            <div className="flex h-17 w-full flex-col justify-center rounded-3xl border border-stroke-primary bg-bg-surface-container p-3.75 shadow-[0px_1px_2px_0px_var(--shadow-soft)]">
              <SegmentedControl.Root
                label={t('feature.onboarding.networkLabel')}
                value={settings.environmentId}
                onChange={value => handleEnvironmentChange(value)}
              >
                {environments.map(env => (
                  <SegmentedControl.Item
                    key={env.id}
                    value={env.id}
                    testId={`${TEST_IDS.networkButton}-${env.id}`}
                    disabled={isNetworkSelectionDisabled}
                  >
                    {env.name}
                  </SegmentedControl.Item>
                ))}
              </SegmentedControl.Root>
            </div>
          )}

          {/* QR Code */}
          <div
            data-testid={TEST_IDS.onboardingQrContainer}
            // Autotest seam: the e2e harness reads the pairing deeplink from here and hands it to a
            // local `truapi-host` signer. `undefined` rather than null/'' so React omits the attribute
            // entirely outside autotest — the harness waits on its presence.
            data-pairing-deeplink={AUTOTEST_ENABLED && qrPayload !== null ? qrPayload : undefined}
            className="box-border flex h-100.5 w-100.5 shrink-0 items-center justify-center rounded-4xl border border-stroke-primary bg-bg-surface-container p-6 shadow-[0px_1px_2px_0px_var(--shadow-soft)]"
          >
            {renderQrBoxContent()}
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-sm text-fg-tertiary">
            <SmartphoneIcon className="size-4" />
            <span>{t('feature.onboarding.phoneHint')}</span>
          </div>
        </div>
      </div>
      {!isProductionBuild() && (
        <div className="mt-4 flex items-center justify-center space-x-4" style={{ appRegion: 'no-drag' }}>
          <Button variant="ghost" data-testid={TEST_IDS.onboardingSkip} onClick={() => navigate({ to: '/dashboard' })}>
            {t('common.action.skip')}
          </Button>
        </div>
      )}
    </div>
  );
};
