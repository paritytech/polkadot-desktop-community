import HomeIcon from '@/shared/assets/images/header/home.svg?jsx';
import { HeaderLink, iconBase } from '@/shared/components';
import { TEST_IDS } from '@/shared/test-ids';
import { cnTw } from '@/shared/utils';
import { useSetMainActivePage } from '@/domains/application';
import { dashboardUseCase } from '@/aggregates/browser-tabs';

const homeIconClassName = cnTw('size-4', iconBase);

export const HomeButton = () => {
  const setMainActivePage = useSetMainActivePage();

  const handleClick = () => {
    setMainActivePage(0);
    dashboardUseCase.selectDashboardTab();
  };

  return (
    <div className="mr-1 ml-2">
      <HeaderLink to="/dashboard" variant="icon" testId={TEST_IDS.homeButton} disableActive onClick={handleClick}>
        <HomeIcon className={homeIconClassName} aria-hidden />
      </HeaderLink>
    </div>
  );
};
