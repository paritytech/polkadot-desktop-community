import { QrCode } from '@novasamatech/host-papp-react-ui';
import { Button, toastError, useTheme } from '@novasamatech/tr-ui';
import { useNavigate } from '@tanstack/react-router';
import { Loader, Smartphone } from 'lucide-react';
import { useCallback, useEffect, useMemo } from 'react';

import PolkadotLogo from '@/shared/assets/images/logo.svg?jsx';
import { Spinner, WindowDragRegion } from '@/shared/components';
import { Slot } from '@/shared/di';
import { reloadApp } from '@/shared/env';
import { useRxState } from '@/shared/rxstate';
import { TEST_IDS } from '@/shared/test-ids';
import { useTranslation } from '@/shared/translation';
import { cnTw } from '@/shared/utils';
import { type EnvironmentId, environmentService, resetDeviceIdentity } from '@/domains/application';
import { useHandshakeV2, userIdentity$ } from '@/domains/sso';
import { networkSettings } from '@/aggregates/network-settings';
import { onboardingTopSlot } from '../di';
import { useOnboardingConnection } from '../hooks/useOnboardingConnection';

import { OnboardingConnectionPanel } from './OnboardingConnectionPanel';

const QR_SIZE = 362;

export const OnboardingScreen = () => {
  const { t } = useTranslation();
  const [settings] = useRxState(networkSettings.settings$);

  const { mode } = useTheme();

  const navigate = useNavigate();

  const { qrPayload, state: handshakeState, isLoading: handshakeLoading } = useHandshakeV2();
  const [persistedUserIdentity] = useRxState(userIdentity$);
  const connectionState = useOnboardingConnection();

  // Already paired (cold-start with stored V2 identity, or just transitioned to
  // Success): jump straight to the dashboard. The check covers both the
  // immediately-after-pairing path and the launch-with-stored-identity path.
  useEffect(() => {
    if (handshakeState.tag === 'Success' || persistedUserIdentity !== null) {
      navigate({ to: '/dashboard' });
    }
  }, [handshakeState.tag, persistedUserIdentity, navigate]);

  const hasError = handshakeState.tag === 'Failed';

  // The peer sends Failed reasons as free-form strings; classify the ones we
  // want specialised UX for. Everything else falls back to the verbatim reason.
  const errorContent = useMemo(() => {
    if (handshakeState.tag !== 'Failed') return null;
    const reason = handshakeState.reason ?? '';
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
  }, [handshakeState, t]);

  useEffect(() => {
    // Only toast generic pairing errors. Recognized states (e.g. account setup)
    // are surfaced by the connection panel, so suppress the toast unless we are
    // deferring to the plain pairing flow.
    if (hasError && errorContent && errorContent.kind !== 'noFreeSlots' && connectionState === 'pairing') {
      toastError({ title: errorContent.title });
    }
  }, [hasError, errorContent, connectionState]);

  // QR is only useful while we're still waiting for Android to scan it
  // (Idle/Submitted). Once Android sends Pending the handshake is in flight —
  // the QR is no longer scannable, so swap it for a loader.
  const showQR = !hasError && qrPayload !== null && (handshakeState.tag === 'Idle' || handshakeState.tag === 'Submitted');
  const showHandshakeProgress = !hasError && handshakeState.tag === 'Pending';
  // Lock the network switcher only while the pairing flow is mid-handshake (QR
  // not yet shown, no error). During connection states, or once the QR/error is
  // visible, the user may switch networks.
  const isNetworkSelectionDisabled = connectionState === 'pairing' && !showQR && !hasError && !handshakeLoading;

  const handleRetry = useCallback(() => {
    resetDeviceIdentity();
    reloadApp();
  }, []);

  const handleEnvironmentChange = (value: EnvironmentId) => {
    if (value === settings.environmentId) return;

    networkSettings.setValue('environmentId', value);
    reloadApp();
  };

  const environments = environmentService.list();

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
        <div className="flex h-full w-full flex-col items-center justify-center gap-8 text-primary">
          <Spinner size={120} />
          <p className="text-center text-base leading-6 font-medium text-fg-secondary">
            {t('feature.onboarding.completingPairing')}
          </p>
        </div>
      );
    }
    if (hasError && errorContent) {
      return (
        <div className="flex h-full w-full flex-col items-center justify-center gap-4 p-8">
          <p className="text-center text-base font-medium text-fg-primary">{errorContent.title}</p>
          <p className="text-center text-sm leading-5 text-fg-secondary">{errorContent.description}</p>
          <Button type="button" size="sm" onClick={handleRetry}>
            {t('common.action.retry')}
          </Button>
        </div>
      );
    }
    return <Loader className="h-12 w-12 animate-spin text-primary" />;
  };

  return (
    <WindowDragRegion className="flex min-h-screen w-screen flex-col items-center justify-center overflow-y-auto bg-bg-surface-nested pt-6 pb-2">
      <div className="mb-4 w-full max-w-300 px-6 empty:hidden" style={{ appRegion: 'no-drag' }}>
        <Slot id={onboardingTopSlot} props={{ qrPayload, environmentId: settings.environmentId }} />
      </div>

      <div
        className="flex flex-col items-center gap-4 px-6 xl:flex-row xl:items-center xl:gap-16"
        style={{ appRegion: 'no-drag' }}
      >
        <div className="flex w-full max-w-172 flex-col items-start gap-3 xl:w-172">
          <div className="flex items-center gap-5">
            <PolkadotLogo className="origin-right" />
            <div className="h-8.5 w-[1.3px] bg-general-foreground" />
            <div className="text-sm leading-5 font-semibold tracking-[0.5px] text-fg-primary uppercase">
              {t('feature.onboarding.logoText')}
            </div>
          </div>
          <h1 className="text-[32px] leading-10 font-semibold tracking-[-0.32px] text-fg-primary xl:text-[48px] xl:leading-16 xl:tracking-[-0.48px]">
            {t('feature.onboarding.mainText')}
          </h1>
          <p className="w-full max-w-172 text-center text-base leading-6 font-medium text-fg-secondary xl:text-left">
            {t('feature.onboarding.description')}
          </p>
        </div>

        <div className="flex w-full max-w-100.5 flex-col items-center gap-2">
          <div className="h-17 w-full rounded-3xl border border-general-border bg-bg-surface-container p-3.75 shadow-[0px_1px_2px_0px_rgba(0,0,0,0.16)]">
            <div className="flex h-9 items-center rounded-[10px] bg-bg-surface-nested p-1">
              {environments.map(env => {
                const isActive = settings.environmentId === env.id;

                return (
                  <button
                    key={env.id}
                    data-testid={`${TEST_IDS.networkButton}-${env.id}`}
                    className={cnTw(
                      'h-7 flex-1 rounded-md px-2 text-sm font-medium transition',
                      isActive
                        ? 'bg-bg-action-primary-inverted text-fg-primary shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_-1px_rgba(0,0,0,0.1)]'
                        : 'bg-transparent text-fg-secondary',
                      !isActive && !isNetworkSelectionDisabled && 'hover:text-fg-primary',
                      isNetworkSelectionDisabled && 'cursor-not-allowed opacity-50',
                    )}
                    disabled={isNetworkSelectionDisabled}
                    onClick={() => handleEnvironmentChange(env.id)}
                  >
                    {env.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* QR Code */}
          <div
            data-testid={TEST_IDS.onboardingQrContainer}
            className="box-border flex h-100.5 w-100.5 shrink-0 items-center justify-center rounded-4xl border border-general-border bg-bg-surface-container p-6 shadow-[0px_1px_2px_0px_rgba(0,0,0,0.16)]"
          >
            {renderQrBoxContent()}
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-sm text-fg-tertiary">
            <Smartphone size={16} />
            <span>{t('feature.onboarding.phoneHint')}</span>
          </div>
        </div>
      </div>
      <div
        data-testid={TEST_IDS.onboardingSkip}
        className="mt-4 flex items-center justify-center space-x-4"
        style={{ appRegion: 'no-drag' }}
      >
        <Button variant="ghost" onClick={() => navigate({ to: '/dashboard' })}>
          {t('common.action.skip')}
        </Button>
      </div>
    </WindowDragRegion>
  );
};
