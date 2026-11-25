import { useNavigate } from '@tanstack/react-router';

import HomeIcon from '@/shared/assets/images/header/home.svg?jsx';
import { IconButton } from '@/shared/components';
import { TEST_IDS } from '@/shared/test-ids';
import { useTranslation } from '@/shared/translation';
import { useSetMainActivePage } from '@/domains/application';
import { dashboardUseCase } from '@/aggregates/browser-tabs';

export const HomeButton = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const setMainActivePage = useSetMainActivePage();

  const handleClick = () => {
    setMainActivePage(0);
    dashboardUseCase.selectDashboardTab();
  };

  return (
    <div className="ms-2 me-1">
      <IconButton
        label={t('feature.dashboard.home')}
        data-testid={TEST_IDS.homeButton}
        onClick={() => {
          handleClick();
          void navigate({ to: '/dashboard' });
        }}
      >
        <HomeIcon className="size-4" aria-hidden />
      </IconButton>
    </div>
  );
};
