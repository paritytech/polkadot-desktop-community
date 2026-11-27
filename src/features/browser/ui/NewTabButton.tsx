import { nanoid } from 'nanoid';

import PlusIcon from '@/shared/assets/images/icons/plus.svg?jsx';
import { IconButton } from '@/shared/components';
import { TEST_IDS } from '@/shared/test-ids';
import { useTranslation } from '@/shared/translation';
import { browserTabs } from '@/aggregates/browser-tabs';
import { focusAddressBarSideEffect } from '../di';
import { NEW_TAB } from '../tabs/helpers';

export const NewTabButton = () => {
  const { t } = useTranslation();

  const handleNewTab = () => {
    const id = nanoid(8);
    browserTabs.addTab({ id, type: NEW_TAB, deeplink: '' }, { persistable: false });
    browserTabs.touchAliveTabId(id);
    browserTabs.selectTab(id);
    void focusAddressBarSideEffect.apply({ newTab: true });
  };

  return (
    <IconButton label={t('feature.browser.newTab')} data-testid={TEST_IDS.newTabButton} onClick={handleNewTab}>
      <PlusIcon className="size-2.75" />
    </IconButton>
  );
};
