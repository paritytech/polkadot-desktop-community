import {
  type DragEndEvent,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { restrictToHorizontalAxis } from '@dnd-kit/modifiers';
import { SortableContext, horizontalListSortingStrategy, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Popover } from '@novasamatech/tr-ui';
import { Pin, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import RotateCwIcon from '@/shared/assets/images/header/rotate-cw.svg?jsx';
import { HeaderButton, iconBase, tabIconClassName } from '@/shared/components';
import { Slot } from '@/shared/di';
import { isElectron } from '@/shared/env';
import { useRxState } from '@/shared/rxstate';
import { TEST_IDS } from '@/shared/test-ids';
import { useTranslation } from '@/shared/translation';
import { cnTw } from '@/shared/utils';
import { useIsPinned } from '@/domains/product';
import { type Tab, browserTabs, isSystemTabType } from '@/aggregates/browser-tabs';
import { onProductRefreshRequestedSideEffect } from '@/aggregates/product-loading';
import { webviewRegistry } from '@/aggregates/webview-registry';
import { tabContentSlot, tabHoverSlot } from '../di';
import { useTabs } from '../hooks/useTabs';
import { PRODUCT } from '../tabs/helpers';

const tabRefreshIconClassName = cnTw('h-[15px] w-[15px]', iconBase);

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
  const { tabs, selectedTabId, select, closeTab, reorderTabs } = useTabs();
  const [hoveredId, setHoveredId] = useState<string | null>(null);
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

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

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

  return (
    <div className="px-2 pb-1">
      <div
        className="group/tabs flex h-8 min-w-0 items-center gap-0.5 rounded-full bg-foreground/8 p-0.5"
        style={{ appRegion: 'no-drag' }}
      >
        <div ref={setScrollContainerEl} className="flex min-w-0 flex-1 items-center gap-0.5 overflow-hidden">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            modifiers={[restrictToHorizontalAxis]}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={tabs.map(t => t.id)} strategy={horizontalListSortingStrategy}>
              {tabs.flatMap((tab, index) => {
                const isActive = selectedTabId === tab.id;
                const isPrevActive = index > 0 && selectedTabId === tabs[index - 1]?.id;
                const isHovered = hoveredId === tab.id;
                const isPrevHovered = index > 0 && hoveredId === tabs[index - 1]?.id;
                const separatorHidden = isActive || isPrevActive || isHovered || isPrevHovered;

                const elements = [
                  <SortableTab
                    key={tab.id}
                    tab={tab}
                    isActive={isActive}
                    onSelect={select}
                    onClose={closeTab}
                    onHoverChange={setHoveredId}
                  />,
                ];

                if (index > 0) {
                  elements.unshift(
                    <div
                      key={`sep-${tab.id}`}
                      className={cnTw(
                        'h-5 w-px shrink-0 transition-colors duration-150',
                        separatorHidden ? 'bg-transparent' : 'bg-text-tertiary/40',
                      )}
                    />,
                  );
                }

                return elements;
              })}
            </SortableContext>
          </DndContext>
        </div>
      </div>
    </div>
  );
};

type SortableTabProps = {
  tab: Tab;
  isActive: boolean;
  onSelect: (tab: Tab) => void;
  onClose: (tab: Tab) => void;
  onHoverChange: (id: string | null) => void;
};

const SortableTab = ({ tab, isActive, onSelect, onClose, onHoverChange }: SortableTabProps) => {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: tab.id });
  const [isHovering, setIsHovering] = useState(false);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Use Translate (not Transform) so dnd-kit's scaleX/scaleY adjustments — which
  // arise because active and inactive tabs have different widths — don't reach
  // the DOM. Scaling the tab during reorder causes the label text to be
  // re-rasterised at a different size, which the eye reads as a font change.
  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  const handleMouseEnter = () => {
    onHoverChange(tab.id);
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
    onHoverChange(null);
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setIsHovering(false);
    if (hoverCardWarm) scheduleWarmCooldown();
  };

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    };
  }, []);

  const showHoverCard = isHovering && !isDragging;
  const setDeeplink = (deeplink: string) => browserTabs.updateTabDeeplink(tab.id, deeplink);

  return (
    <Popover open={showHoverCard}>
      <Popover.Anchor asChild>
        <div
          ref={setNodeRef}
          data-tab-id={tab.id}
          style={style}
          className={cnTw(
            'group @container relative flex h-7 cursor-pointer items-center justify-center gap-2 rounded-full transition-colors duration-150 select-none',
            isActive
              ? 'min-w-[148px] flex-1 bg-elevated px-4 py-1'
              : 'min-w-[65px] flex-1 bg-transparent px-4 py-1 hover:bg-foreground/10',
            isDragging && 'z-10 opacity-90 shadow-lg',
          )}
          onClick={() => onSelect(tab)}
          onAuxClick={e => {
            if (e.button === 1) onClose(tab);
          }}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          {...attributes}
          {...listeners}
        >
          <span className="flex min-w-0 flex-1 items-center justify-center gap-2 overflow-hidden pl-3.5">
            <Slot id={tabContentSlot} props={{ tab, setDeeplink, isActive }} />
          </span>
          <button
            className="absolute top-1/2 left-0.5 flex size-6 origin-center -translate-y-1/2 scale-75 items-center justify-center rounded-full p-1 opacity-0 transition-[opacity,background-color,transform] duration-150 ease-out group-hover:scale-100 group-hover:opacity-100 hover:bg-foreground/15"
            aria-label={t('feature.browser.closeTab')}
            onClick={e => {
              e.stopPropagation();
              onClose(tab);
            }}
          >
            <X className={tabIconClassName} size={16} strokeWidth={1.3} aria-hidden />
          </button>
        </div>
      </Popover.Anchor>
      <Popover.Content
        side="bottom"
        sideOffset={4}
        collisionPadding={8}
        variant="flush"
        onOpenAutoFocus={e => e.preventDefault()}
      >
        <div className="pointer-events-none flex w-max max-w-72 min-w-44 flex-col gap-2 p-3">
          <Slot id={tabHoverSlot} props={{ tab }} />
          {!isSystemTabType(tab.type) && (
            <div className="flex items-center gap-1.5">
              <TabRamUsageRow tabId={tab.id} />
              {tab.type === PRODUCT && <ProductPinGlyph productId={tab.id} />}
            </div>
          )}
        </div>
      </Popover.Content>
    </Popover>
  );
};

const ProductPinGlyph = ({ productId }: { productId: string }) => {
  const pinned = useIsPinned(productId);
  if (!pinned) return null;
  return <Pin data-testid={TEST_IDS.tabHoverVersionPin} className="size-3 shrink-0 text-text-secondary" aria-hidden />;
};

const TabRamUsageRow = ({ tabId }: { tabId: string }) => {
  const { t } = useTranslation();
  const memory = useTabMemory(tabId);
  return (
    <span className="text-sm leading-[18px] text-text-secondary">
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

export const BrowserRefreshButton = () => {
  const { tabs, selectedTabId } = useTabs();
  const [spinning, setSpinning] = useState(false);

  if (tabs.length === 0) return null;

  const handleRefresh = () => {
    if (selectedTabId) {
      setSpinning(true);
      void onProductRefreshRequestedSideEffect.apply({ identifier: selectedTabId });
    }
  };

  return (
    <HeaderButton variant="icon" onClick={handleRefresh}>
      <RotateCwIcon
        className={cnTw(tabRefreshIconClassName, spinning && 'animate-[spin_0.5s_ease-in-out]')}
        aria-hidden
        onAnimationEnd={() => setSpinning(false)}
      />
    </HeaderButton>
  );
};
