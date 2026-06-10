import { useLocation } from '@tanstack/react-router';

import { HistoryNavigationButtons } from '@/shared/components';
import { TEST_IDS } from '@/shared/test-ids';
import { useTranslation } from '@/shared/translation';
import { useTabHistoryNavigation } from '../hooks/useTabHistoryNavigation';

export const NavigationButtons = () => {
  const { t } = useTranslation();
  const pathname = useLocation({ select: location => location.pathname });
  const { canGoBack, canGoForward, goBack, goForward } = useTabHistoryNavigation();

  if (pathname.startsWith('/settings')) return null;

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
