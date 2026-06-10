import { useLocation } from '@tanstack/react-router';

import { HistoryNavigationButtons } from '@/shared/components';
import { TEST_IDS } from '@/shared/test-ids';
import { useTranslation } from '@/shared/translation';
import { useSettingsHistoryNavigation } from '../hooks/useSettingsHistoryNavigation';

export const SettingsNavigationButtons = () => {
  const { t } = useTranslation();
  const pathname = useLocation({ select: location => location.pathname });
  const { canGoBack, canGoForward, goBack, goForward } = useSettingsHistoryNavigation();

  if (!pathname.startsWith('/settings')) return null;

  return (
    <HistoryNavigationButtons
      canGoBack={canGoBack}
      canGoForward={canGoForward}
      goBack={goBack}
      goForward={goForward}
      backAriaLabel={t('feature.browser.navigationBackAria')}
      forwardAriaLabel={t('feature.browser.navigationForwardAria')}
      backTestId={TEST_IDS.navigationBackButton}
      forwardTestId={TEST_IDS.navigationForwardButton}
    />
  );
};
