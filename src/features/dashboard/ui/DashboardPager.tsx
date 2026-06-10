import { type ReactNode, forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef } from 'react';

import { TEST_IDS } from '@/shared/test-ids';

export type DashboardPagerHandle = {
  scrollToPage: (index: number, behavior?: ScrollBehavior) => void;
  getVisiblePageIndex: () => number;
};

type DashboardPagerProps = {
  pageCount: number;
  activePageIndex: number;
  onActivePageIndexChange: (index: number) => void;
  onVisiblePageIndexChange: (index: number) => void;
  renderPage: (pageIndex: number) => ReactNode;
};

export const DashboardPager = forwardRef<DashboardPagerHandle, DashboardPagerProps>(function DashboardPager(
  { pageCount, activePageIndex, onActivePageIndexChange, onVisiblePageIndexChange, renderPage },
  ref,
) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isScrollDrivenIndexChangeRef = useRef(false);
  const lastVisiblePageIndexRef = useRef(activePageIndex);
  // Prevents programmatic scrolling from being treated as a user page change.
  const isProgrammaticScrollRef = useRef(false);
  const programmaticScrollTimerRef = useRef<number | null>(null);

  const scrollToPage = useCallback((index: number, behavior: ScrollBehavior) => {
    const container = scrollRef.current;
    if (!container) return;
    isProgrammaticScrollRef.current = true;
    container.scrollTo({ left: index * container.clientWidth, behavior });

    if (programmaticScrollTimerRef.current !== null) {
      window.clearTimeout(programmaticScrollTimerRef.current);
    }
    programmaticScrollTimerRef.current = window.setTimeout(() => {
      isProgrammaticScrollRef.current = false;
      programmaticScrollTimerRef.current = null;
    }, 450);
  }, []);

  const getVisiblePageIndex = useCallback((): number => {
    const container = scrollRef.current;
    if (!container || container.clientWidth === 0) {
      return activePageIndex;
    }
    return Math.round(container.scrollLeft / container.clientWidth);
  }, [activePageIndex]);

  useImperativeHandle(
    ref,
    () => ({
      scrollToPage: (index: number, behavior: ScrollBehavior = 'smooth') => {
        scrollToPage(index, behavior);
      },
      getVisiblePageIndex,
    }),
    [getVisiblePageIndex, scrollToPage],
  );

  // Align scroll position when the active page is changed from outside (e.g. toolbar click or new page added).
  useLayoutEffect(() => {
    // Skip re-scrolling when active index came from user scroll itself.
    // In that case CSS scroll-snap will finish alignment naturally.
    if (isScrollDrivenIndexChangeRef.current) {
      isScrollDrivenIndexChangeRef.current = false;
      return;
    }

    const container = scrollRef.current;
    if (!container) return;
    const target = Math.round(container.scrollLeft / container.clientWidth);
    if (target === activePageIndex) return;
    scrollToPage(activePageIndex, 'smooth');
  }, [activePageIndex, pageCount, scrollToPage]);

  // Keep the active page centered when the viewport resizes.
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => {
      scrollToPage(activePageIndex, 'auto');
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [activePageIndex, scrollToPage]);

  useEffect(() => {
    lastVisiblePageIndexRef.current = activePageIndex;
  }, [activePageIndex]);

  const getPageIndexFromScroll = useCallback(
    (container: HTMLDivElement) => {
      if (container.clientWidth === 0) return activePageIndex;
      const rawIndex = Math.round(container.scrollLeft / container.clientWidth);
      return Math.max(0, Math.min(pageCount - 1, rawIndex));
    },
    [activePageIndex, pageCount],
  );

  // Update the page indicator immediately while scrolling.
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const handleScroll = () => {
      const nextIndex = getPageIndexFromScroll(container);
      if (nextIndex === lastVisiblePageIndexRef.current) return;
      lastVisiblePageIndexRef.current = nextIndex;
      onVisiblePageIndexChange(nextIndex);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [getPageIndexFromScroll, onVisiblePageIndexChange]);

  // Sync active index only after the snap animation finishes to avoid re-rendering widgets mid-swipe.
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const handleScrollEnd = () => {
      if (isProgrammaticScrollRef.current) return;

      const nextIndex = getPageIndexFromScroll(container);
      if (nextIndex !== activePageIndex) {
        isScrollDrivenIndexChangeRef.current = true;
        onActivePageIndexChange(nextIndex);
      }
    };

    container.addEventListener('scrollend', handleScrollEnd);
    return () => {
      container.removeEventListener('scrollend', handleScrollEnd);
    };
  }, [activePageIndex, getPageIndexFromScroll, onActivePageIndexChange]);

  useEffect(() => {
    return () => {
      if (programmaticScrollTimerRef.current !== null) {
        window.clearTimeout(programmaticScrollTimerRef.current);
      }
    };
  }, []);

  return (
    <div
      ref={scrollRef}
      data-testid={TEST_IDS.dashboardPager}
      className="scrollbar-hidden flex-1 snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain scroll-smooth"
    >
      <div className="flex h-full">
        {Array.from({ length: pageCount }).map((_, index) => (
          <section
            // eslint-disable-next-line react/no-array-index-key
            key={index}
            className="flex h-full w-full shrink-0 basis-full snap-start snap-always flex-col overflow-hidden"
            aria-hidden={index !== activePageIndex}
          >
            {renderPage(index)}
          </section>
        ))}
      </div>
    </div>
  );
});
