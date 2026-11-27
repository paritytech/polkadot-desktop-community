import { type ReactNode } from 'react';

import ClockIcon from '@/shared/assets/images/icons/clock.svg?jsx';
import WifiOffIcon from '@/shared/assets/images/icons/wifi-off.svg?jsx';
import { Button, Spinner } from '@/shared/components';
import { TEST_IDS } from '@/shared/test-ids';
import { useTranslation } from '@/shared/translation';
import { type OnboardingConnectionState } from '../types';

type Props = {
  state: Exclude<OnboardingConnectionState, 'pairing'>;
  onRetry: VoidFunction;
};

const spinnerIcon = <Spinner size={24} />;

const ICONS: Record<Exclude<OnboardingConnectionState, 'pairing'>, ReactNode> = {
  offline: <WifiOffIcon className="size-6 text-fg-primary" />,
  reaching: spinnerIcon,
  restored: spinnerIcon,
  accountSetup: <ClockIcon className="size-6 text-fg-primary" />,
};

export const OnboardingConnectionPanel = ({ state, onRetry }: Props) => {
  const { t } = useTranslation();

  return (
    <div
      data-testid={TEST_IDS.onboardingConnectionPanel}
      className="flex h-full w-full flex-col items-center justify-center gap-4 p-4"
    >
      <span className="flex size-12 items-center justify-center rounded-2xl bg-bg-surface-nested text-fg-primary">
        {ICONS[state]}
      </span>
      <div className="flex flex-col items-center gap-1">
        <p className="text-center text-base font-semibold text-fg-primary">{t(`feature.onboarding.connection.${state}.title`)}</p>
        <p className="text-center text-sm text-fg-secondary">{t(`feature.onboarding.connection.${state}.subtitle`)}</p>
      </div>
      {state === 'accountSetup' && (
        <Button variant="primary" type="button" size="sm" data-testid={TEST_IDS.onboardingRetryButton} onClick={onRetry}>
          {t('common.action.retry')}
        </Button>
      )}
    </div>
  );
};
