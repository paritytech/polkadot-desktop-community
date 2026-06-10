import { nanoid } from 'nanoid';

import PlusIcon from '@/shared/assets/images/header/plus.svg?jsx';
import { HeaderButton, iconBase } from '@/shared/components';
import { TEST_IDS } from '@/shared/test-ids';
import { browserTabs } from '@/aggregates/browser-tabs';
import { focusAddressBarSideEffect } from '../di';
import { NEW_TAB } from '../tabs/helpers';

const plusIconClassName = `h-[10.6px] w-[10.6px] ${iconBase}`;

export const NewTabButton = () => {
  const handleNewTab = () => {
    const id = nanoid(8);
    browserTabs.addTab({ id, type: NEW_TAB, deeplink: '' }, { persistable: false });
    browserTabs.touchAliveTabId(id);
    browserTabs.selectTab(id);
    void focusAddressBarSideEffect.apply({ newTab: true });
  };

  return (
    <HeaderButton variant="icon" testId={TEST_IDS.newTabButton} onClick={handleNewTab}>
      <PlusIcon className={plusIconClassName} aria-hidden />
    </HeaderButton>
  );
};
