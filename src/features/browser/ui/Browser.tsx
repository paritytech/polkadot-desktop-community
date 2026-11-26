import { useLocation } from '@tanstack/react-router';
import { type ReactNode, memo, useCallback, useState } from 'react';

import { useSideEffect } from '@/shared/di';
import { isElectron } from '@/shared/env';
import { useLooseRef } from '@/shared/hooks';
import { useRxState } from '@/shared/rxstate';
import { useTranslation } from '@/shared/translation';
import { cnTw } from '@/shared/utils';
import { type DotNsUrl, lifecycleUseCase } from '@/domains/product';
import { type Tab, browserTabs } from '@/aggregates/browser-tabs';
import { onProductRefreshRequestedSideEffect } from '@/aggregates/product-loading';
import { Webview } from '@/widgets/Webview';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useSwipeNavigation } from '../hooks/useSwipeNavigation';
import { useTabHistoryNavigation } from '../hooks/useTabHistoryNavigation';
import { PRODUCT } from '../tabs/helpers';
import { type SwipeWheel } from '../types';

import { FindOverlay } from './FindOverlay';
import { ProductLoader } from './ProductLoader';
import { SwipeNavigationIndicator } from './SwipeNavigationIndicator';
import { ZoomIndicator } from './ZoomIndicator';

export const Browser = memo(() => {
  const { t } = useTranslation();
  const [tabs] = useRxState(browserTabs.tabs$);
  const [aliveTabs] = useRxState(browserTabs.aliveTabs$);
  const [selectedTabId] = useRxState(browserTabs.selectedTabId$);
  const [refreshKeys, setRefreshKeys] = useState<Record<string, number>>({});

  useKeyboardShortcuts();

  // Mirrors `isProductRoute` in src/routes/_app.tsx: `Browser` stays mounted, hidden, on every other route.
  const onProductRoute = useLocation({ select: location => location.pathname.startsWith('/product/') });
  const navigation = useTabHistoryNavigation();
  const swipe = useSwipeNavigation({ enabled: onProductRoute, tabId: selectedTabId, navigation });

  useSideEffect(onProductRefreshRequestedSideEffect, ({ identifier }) => {
    lifecycleUseCase.refreshProduct(identifier);
    setRefreshKeys(prev => ({ ...prev, [identifier]: (prev[identifier] ?? 0) + 1 }));
  });

  if (tabs.length === 0) {
    return <div className="flex h-full w-full items-center justify-center">{t('common.status.noProductFound')}</div>;
  }

  const aliveProductTabs = tabs.filter(tab => tab.type === PRODUCT && aliveTabs.includes(tab.id));

  return (
    <div className="relative h-full w-full">
      {aliveProductTabs.map(tab => (
        <Content
          key={`${tab.id}-${refreshKeys[tab.id] ?? 0}`}
          tab={tab}
          visible={tab.id === selectedTabId}
          onGuestWheel={tab.id === selectedTabId ? swipe.onGuestWheel : undefined}
        />
      ))}
      <SwipeNavigationIndicator indicator={swipe.indicator} />
    </div>
  );
});

const Content = memo(
  ({ tab, visible, onGuestWheel }: { tab: Tab; visible: boolean; onGuestWheel?: (wheel: SwipeWheel) => void }) => {
    const { t } = useTranslation();
    const visibleRef = useLooseRef(visible);

    const handleDeeplinkChange = useCallback(
      (deeplink: string) => {
        browserTabs.updateTabDeeplink(tab.id, deeplink);
      },
      [tab.id],
    );

    const handleCrossProductLink = useCallback(
      (target: DotNsUrl) => {
        if (!visibleRef()) return;
        browserTabs.addTab({ id: target.identifier, type: PRODUCT, deeplink: target.pathname }, { persistable: true });
        browserTabs.touchAliveTabId(target.identifier);
        browserTabs.selectTab(target.identifier);
      },
      [visibleRef],
    );

    let content: ReactNode = (
      <div className="absolute inset-0 m-auto h-fit w-fit">{t('feature.browser.webVersionNotification')}</div>
    );

    if (isElectron()) {
      content = (
        <Webview
          kind="app"
          identifier={tab.id}
          loader={<ProductLoader identifier={tab.id} />}
          pathname={tab.deeplink}
          visible={visible}
          onCrossProductLink={handleCrossProductLink}
          onPathnameChange={handleDeeplinkChange}
          onGuestWheel={onGuestWheel}
        />
      );
    }

    return (
      <div
        className={cnTw(
          'flex flex-col overflow-hidden bg-bg-surface-container',
          visible ? 'relative h-full w-full' : 'invisible absolute inset-0',
        )}
        aria-hidden={!visible}
      >
        {content}
        {isElectron() && visible && <FindOverlay tabId={tab.id} />}
        {isElectron() && visible && <ZoomIndicator tabId={tab.id} />}
      </div>
    );
  },
);
