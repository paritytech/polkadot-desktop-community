import { useRxState } from '@/shared/rxstate';
import { type Tab, browserTabs } from '@/aggregates/browser-tabs';

export const useTabs = () => {
  const [tabs] = useRxState(browserTabs.tabs$);
  const [selectedTabId] = useRxState(browserTabs.selectedTabId$);

  const select = (tab: Tab) => {
    if (browserTabs.selectedTabId$.get() === tab.id) {
      browserTabs.sameTabClicked$.emit();
      return;
    }
    browserTabs.selectTab(tab.id);
  };

  const closeTab = (tab: Tab) => {
    const current = browserTabs.tabs$.get();
    if (browserTabs.selectedTabId$.get() === tab.id) {
      const index = current.findIndex(t => t.id === tab.id);
      const neighbor = current[index - 1] ?? current[index + 1] ?? null;
      browserTabs.selectTab(neighbor ? neighbor.id : null);
    }
    browserTabs.removeAliveTabId(tab.id);
    browserTabs.removeTab(tab.id);
  };

  return {
    tabs,
    selectedTabId,
    select,
    closeTab,
    reorderTabs: browserTabs.reorderTabs,
  };
};
