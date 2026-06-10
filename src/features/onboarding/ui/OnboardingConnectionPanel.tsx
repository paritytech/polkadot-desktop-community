import { Button } from '@novasamatech/tr-ui';
import { Clock, WifiOff } from 'lucide-react';
import { type ReactNode } from 'react';

import { Spinner } from '@/shared/components';
import { TEST_IDS } from '@/shared/test-ids';
import { useTranslation } from '@/shared/translation';
import { type OnboardingConnectionState } from '../types';

type Props = {
  state: Exclude<OnboardingConnectionState, 'pairing'>;
  onRetry: VoidFunction;
};

const spinnerIcon = <Spinner size={24} />;

const ICONS: Record<Exclude<OnboardingConnectionState, 'pairing'>, ReactNode> = {
  offline: <WifiOff className="size-6 text-fg-primary" />,
  reaching: spinnerIcon,
  restored: spinnerIcon,
  accountSetup: <Clock className="size-6 text-fg-primary" />,
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
        <Button type="button" size="sm" data-testid={TEST_IDS.onboardingRetryButton} onClick={onRetry}>
          {t('common.action.retry')}
        </Button>
      )}
    </div>
  );
};
