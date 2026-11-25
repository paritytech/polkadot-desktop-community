import { type DragEndEvent, DndContext, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import { restrictToHorizontalAxis } from '@dnd-kit/modifiers';
import { SortableContext, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Pin, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Popover, SegmentedControl } from '@/shared/components';
import { Slot } from '@/shared/di';
import { isElectron } from '@/shared/env';
import { useRxState } from '@/shared/rxstate';
import { TEST_IDS } from '@/shared/test-ids';
import { useTranslation } from '@/shared/translation';
import { cnTw } from '@/shared/utils';
import { useIsPinned } from '@/domains/product';
import { type Tab, browserTabs, isSystemTabType } from '@/aggregates/browser-tabs';
import { webviewRegistry } from '@/aggregates/webview-registry';
import { tabContentSlot, tabHoverSlot } from '../di';
import { useTabs } from '../hooks/useTabs';
import { PRODUCT } from '../tabs/helpers';

const FADE_PX = 48;

const HOVER_CARD_DELAY_MS = 1000;
const HOVER_CARD_WARM_MS = 400;

let hoverCardWarm = false;
let warmCooldownTimer: ReturnType<typeof setTimeout> | null = null;

const scheduleWarmCooldown = () => {
  if (warmCooldownTimer) clearTimeout(warmCooldownTimer);
  warmCooldownTimer = setTimeout(() => {
    hoverCardWarm = false;
    warmCooldownTimer = null;
  }, HOVER_CARD_WARM_MS);
};

const cancelWarmCooldown = () => {
  if (warmCooldownTimer) {
    clearTimeout(warmCooldownTimer);
    warmCooldownTimer = null;
  }
};

const updateMask = (el: HTMLElement) => {
  const left = el.scrollLeft > 1;
  const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;

  if (!left && !right) {
    el.style.maskImage = '';
  } else {
    const l = left ? `transparent, black ${FADE_PX}px` : 'black';
    const r = right ? `black calc(100% - ${FADE_PX}px), transparent` : 'black';
    el.style.maskImage = `linear-gradient(to right, ${l}, ${r})`;
  }
};

export const Tabs = () => {
  const { t } = useTranslation();
  const { tabs, selectedTabId, select, closeTab, reorderTabs } = useTabs();
  const [isDragging, setIsDragging] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const wheelDetachRef = useRef<VoidFunction | null>(null);

  const setScrollContainerEl = useCallback((el: HTMLDivElement | null) => {
    wheelDetachRef.current?.();
    wheelDetachRef.current = null;
    scrollRef.current = el;

    if (!el) return;

    const handleWheel = (e: globalThis.WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY + e.deltaX;
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    wheelDetachRef.current = () => {
      el.removeEventListener('wheel', handleWheel);
    };
  }, []);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // Update fade mask on scroll / resize — no React state, no re-renders
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const sync = () => updateMask(el);
    sync();

    el.addEventListener('scroll', sync, { passive: true });
    const ro = new ResizeObserver(sync);
    ro.observe(el);

    return () => {
      el.removeEventListener('scroll', sync);
      ro.disconnect();
    };
  }, [tabs.length]);

  // Auto-scroll active tab into view — also re-run when tabs are added so a newly
  // created tab (selection changes BEFORE tabs$ updates) gets scrolled once it renders.
  useEffect(() => {
    if (!selectedTabId) return;
    const el = scrollRef.current?.querySelector(`[data-tab-id="${selectedTabId}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }
  }, [selectedTabId, tabs.length]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) reorderTabs(String(active.id), String(over.id));
  };

  if (tabs.length === 0) return null;
  const isSingleActiveTab = tabs.length === 1 && selectedTabId === tabs[0]?.id;
  if (isSingleActiveTab) return null;

  const handleChange = (id: string) => {
    const tab = tabs.find(candidate => candidate.id === id);
    if (tab) select(tab);
  };

  return (
    <div className="px-2 pb-1" data-testid={TEST_IDS.browserTabStrip}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToHorizontalAxis]}
        onDragStart={() => setIsDragging(true)}
        onDragEnd={event => {
          setIsDragging(false);
          handleDragEnd(event);
        }}
        onDragCancel={() => setIsDragging(false)}
      >
        <SortableContext items={tabs.map(tab => tab.id)} strategy={horizontalListSortingStrategy}>
          <SegmentedControl.Root
            label={t('feature.browser.tabsAria')}
            value={selectedTabId}
            holdIndicator={isDragging}
            railRef={setScrollContainerEl}
            onChange={handleChange}
          >
            {tabs.map(tab => (
              <SortableTab key={tab.id} tab={tab} isActive={selectedTabId === tab.id} onClose={closeTab} />
            ))}
          </SegmentedControl.Root>
        </SortableContext>
      </DndContext>
    </div>
  );
};

type SortableTabProps = {
  tab: Tab;
  isActive: boolean;
  onClose: (tab: Tab) => void;
};

const SortableTab = ({ tab, isActive, onClose }: SortableTabProps) => {
  const { t } = useTranslation();
  const { listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: tab.id });
  const [isHovering, setIsHovering] = useState(false);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tabElementRef = useRef<HTMLDivElement | null>(null);

  // Combine dnd-kit's node ref with our own so we can hit-test the tab against the
  // pointer (see the global pointermove safety net below).
  const setTabRef = useCallback(
    (el: HTMLDivElement | null) => {
      tabElementRef.current = el;
      setNodeRef(el);
    },
    [setNodeRef],
  );

  const closeHoverCard = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setIsHovering(false);
    if (hoverCardWarm) scheduleWarmCooldown();
  }, []);

  // Use Translate (not Transform) so dnd-kit's scaleX/scaleY adjustments — which
  // arise because active and inactive tabs have different widths — don't reach
  // the DOM. Scaling the tab during reorder causes the label text to be
  // re-rasterised at a different size, which the eye reads as a font change.
  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  const handleMouseEnter = () => {
    cancelWarmCooldown();
    if (hoverCardWarm) {
      setIsHovering(true);
      return;
    }
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovering(true);
      hoverCardWarm = true;
    }, HOVER_CARD_DELAY_MS);
  };

  const handleMouseLeave = () => {
    closeHoverCard();
  };

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    };
  }, []);

  const showHoverCard = isHovering && !isDragging;

  // Safety net for a swallowed mouseleave: the notification toast renders fixed at
  // top-center (z-index 999999999), directly over the tab strip. When it appears,
  // dismisses, or intercepts pointer events, the tab's own onMouseLeave can fail to
  // fire, leaving the hover card stuck open. While the card is open, track the
  // pointer globally and close as soon as it leaves the tab bounds.
  useEffect(() => {
    if (!showHoverCard) return;

    const handlePointerMove = (event: PointerEvent) => {
      const el = tabElementRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const isOutside =
        event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
      if (isOutside) closeHoverCard();
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    return () => window.removeEventListener('pointermove', handlePointerMove);
  }, [showHoverCard, closeHoverCard]);

  const setDeeplink = (deeplink: string) => browserTabs.updateTabDeeplink(tab.id, deeplink);

  return (
    <Popover.Root open={showHoverCard}>
      <Popover.Anchor asChild>
        <div
          ref={setTabRef}
          data-tab-id={tab.id}
          style={style}
          className={cnTw(
            'group @container relative flex flex-1 items-center rounded-full',
            isActive ? 'min-w-37' : 'min-w-16.25',
            isDragging && 'z-10 opacity-90',
          )}
          onAuxClick={e => {
            if (e.button === 1) onClose(tab);
          }}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          {...listeners}
        >
          <SegmentedControl.Item value={tab.id}>
            <span className="flex min-w-0 flex-1 items-center justify-center gap-2 overflow-hidden ps-3.5">
              <Slot id={tabContentSlot} props={{ tab, setDeeplink, isActive }} />
            </span>
          </SegmentedControl.Item>
          <button
            tabIndex={-1}
            data-no-app-focus
            className="absolute start-0.5 top-1/2 z-10 flex size-5 origin-center -translate-y-1/2 scale-75 cursor-pointer items-center justify-center rounded-full opacity-0 transition-[opacity,background-color,transform] duration-150 ease-out group-hover:scale-100 group-hover:opacity-100 hover:bg-chrome-fill-strong"
            aria-label={t('feature.browser.closeTab')}
            onClick={e => {
              e.stopPropagation();
              onClose(tab);
            }}
          >
            <X size={12} strokeWidth={1.5} aria-hidden />
          </button>
        </div>
      </Popover.Anchor>
      <Popover.Content side="bottom" sideOffset={4} collisionPadding={8} onOpenAutoFocus={e => e.preventDefault()}>
        <div className="pointer-events-none flex w-max max-w-72 min-w-44 flex-col gap-2 p-3" data-testid={TEST_IDS.tabHoverCard}>
          <Slot id={tabHoverSlot} props={{ tab }} />
          {!isSystemTabType(tab.type) && (
            <div className="flex items-center gap-1.5">
              <TabRamUsageRow tabId={tab.id} />
              {tab.type === PRODUCT && <ProductPinGlyph productId={tab.id} />}
            </div>
          )}
        </div>
      </Popover.Content>
    </Popover.Root>
  );
};

const ProductPinGlyph = ({ productId }: { productId: string }) => {
  const pinned = useIsPinned(productId);
  if (!pinned) return null;
  return <Pin data-testid={TEST_IDS.tabHoverVersionPin} className="size-3 shrink-0 text-fg-secondary" aria-hidden />;
};

const TabRamUsageRow = ({ tabId }: { tabId: string }) => {
  const { t } = useTranslation();
  const memory = useTabMemory(tabId);
  return (
    <span className="text-sm leading-4.5 text-fg-secondary" data-testid={TEST_IDS.tabHoverRam}>
      {memory === null
        ? t('feature.browser.ramUsageUnavailable')
        : t('feature.browser.ramUsage', { value: formatMemory(memory) })}
    </span>
  );
};

const useTabMemory = (tabId: string): number | null => {
  const [webContentIds] = useRxState(webviewRegistry.ids$);
  const webContentsId = webContentIds[tabId];
  const [memory, setMemory] = useState<number | null>(null);

  useEffect(() => {
    if (!isElectron() || !webContentsId) {
      setMemory(null);
      return;
    }

    let cancelled = false;
    const fetchMemory = async () => {
      const bytes = await window.App.getWebContentsMemory(webContentsId);
      if (!cancelled) setMemory(bytes);
    };

    void fetchMemory();
    const interval = setInterval(fetchMemory, 2000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [webContentsId]);

  return memory;
};

const formatMemory = (bytes: number): string => {
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)}GB`;
  if (mb >= 10) return `${Math.round(mb)}MB`;
  return `${mb.toFixed(1)}MB`;
};
