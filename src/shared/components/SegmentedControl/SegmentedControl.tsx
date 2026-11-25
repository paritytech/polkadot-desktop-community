import {
  type FocusEvent,
  type KeyboardEvent,
  type PropsWithChildren,
  type Ref,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { cnTw } from '@/shared/utils';

type IndicatorBox = { x: number; y: number; width: number; height: number };

type SegmentedControlContextValue = {
  value: Nullable<string>;
  onChange: (value: string) => void;
  setFocusedValue: (value: string) => void;
  stopValue: Nullable<string>;
  indicatorPlaced: boolean;
};

const SegmentedControlContext = createContext<Nullable<SegmentedControlContextValue>>(null);

const ITEM_SELECTOR = '[data-segment-item]';

const FOCUS_KEYS: Partial<Record<string, (index: number, count: number) => number>> = {
  ArrowRight: (index, count) => (index + 1) % count,
  ArrowDown: (index, count) => (index + 1) % count,
  ArrowLeft: (index, count) => (index - 1 + count) % count,
  ArrowUp: (index, count) => (index - 1 + count) % count,
  Home: () => 0,
  End: (_index, count) => count - 1,
};

const RTL_KEYS: Partial<Record<string, string>> = { ArrowLeft: 'ArrowRight', ArrowRight: 'ArrowLeft' };

function enabledItemsOf(rail: HTMLElement): HTMLButtonElement[] {
  return Array.from(rail.querySelectorAll<HTMLButtonElement>(ITEM_SELECTOR)).filter(item => !item.disabled);
}

// Layout offsets, not client rects, so a transform on the item or a parent (a drag, a popover's opening) never skews
// them. The sum climbs the offsetParent chain because a consumer may wrap each item in a positioned element.
function measureIndicator(rail: HTMLElement, holdIndicator: boolean): Nullable<IndicatorBox> {
  const pressed = rail.querySelector<HTMLElement>(`${ITEM_SELECTOR}[aria-pressed='true']`);
  // A hidden rail, such as a closed popover's, measures zero.
  if (holdIndicator || pressed === null || pressed.offsetWidth === 0) {
    return null;
  }

  let x = 0;
  let y = 0;
  for (
    let element: Nullable<Element> = pressed;
    element instanceof HTMLElement && element !== rail;
    element = element.offsetParent
  ) {
    x += element.offsetLeft;
    y += element.offsetTop;
  }

  return { x, y, width: pressed.offsetWidth, height: pressed.offsetHeight };
}

function isSameBox(a: Nullable<IndicatorBox>, b: Nullable<IndicatorBox>): boolean {
  if (!a || !b) return a === b;

  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}

// dot.li's tab stop: the focused item while focus is inside the group, else the pressed one, else the first. Only an
// enabled item counts, as a disabled button cannot take focus: a disabled pressed item passes the stop to the first
// enabled one, and a group whose items are all disabled has none. A value no enabled item has (an item removed while
// it has focus fires no focusout) falls through to the next rule.
function pickStopValue(rail: HTMLElement, focusedValue: Nullable<string>, value: Nullable<string>): Nullable<string> {
  const values = enabledItemsOf(rail).map(item => item.dataset['segmentValue']);
  const rendered = (candidate: Nullable<string>) => candidate !== null && values.includes(candidate);

  if (rendered(focusedValue)) return focusedValue;
  if (rendered(value)) return value;

  return values[0] ?? null;
}

type SegmentedControlRootProps = PropsWithChildren<{
  /** The group's accessible name. */
  label: string;
  /** The pressed item's value; `null` presses none. */
  value: Nullable<string>;
  /** Called with a newly picked value, never with the pressed one. */
  onChange: (value: string) => void;
  /** While true, the sliding indicator hides and the pressed item paints its own fill. */
  holdIndicator?: boolean;
  /** The rail that holds the items, for a consumer that scrolls it. */
  railRef?: Ref<HTMLDivElement>;
}>;

const SegmentedControlRoot = ({
  label,
  value,
  onChange,
  holdIndicator = false,
  railRef,
  children,
}: SegmentedControlRootProps) => {
  const ownRailRef = useRef<HTMLDivElement>(null);
  const [focusedValue, setFocusedValue] = useState<Nullable<string>>(null);
  const [stopValue, setStopValue] = useState<Nullable<string>>(null);
  const [indicator, setIndicator] = useState<Nullable<IndicatorBox>>(null);
  const placeIndicatorRef = useRef<VoidFunction>(null);

  const setRail = useCallback(
    (element: HTMLDivElement | null) => {
      ownRailRef.current = element;
      if (typeof railRef === 'function') {
        railRef(element);
      } else if (railRef) {
        railRef.current = element;
      }
    },
    [railRef],
  );

  // After every render: an item added, closed or reordered moves the pressed one without resizing anything.
  useLayoutEffect(() => {
    const rail = ownRailRef.current;
    if (!rail) return;

    const placeIndicator = () => {
      const next = measureIndicator(rail, holdIndicator);
      if (!isSameBox(indicator, next)) setIndicator(next);
    };
    placeIndicatorRef.current = placeIndicator;
    placeIndicator();
    const nextStopValue = pickStopValue(rail, focusedValue, value);
    if (nextStopValue !== stopValue) setStopValue(nextStopValue);
    if (focusedValue !== null && nextStopValue !== focusedValue) setFocusedValue(null);
  });

  useEffect(() => {
    const rail = ownRailRef.current;
    if (!rail || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(() => placeIndicatorRef.current?.());
    observer.observe(rail);

    return () => observer.disconnect();
  }, []);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const rail = ownRailRef.current;
    if (!rail) return;

    const isRtl = getComputedStyle(event.currentTarget).direction === 'rtl';
    const move = FOCUS_KEYS[isRtl ? (RTL_KEYS[event.key] ?? event.key) : event.key];
    const items = enabledItemsOf(rail);
    const index = items.findIndex(item => item === event.target);
    if (!move || index < 0) return;

    event.preventDefault();
    items[move(index, items.length)]?.focus();
  };

  const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return;

    setFocusedValue(null);
  };

  const indicatorPlaced = indicator !== null;
  const context = useMemo(
    () => ({ value, onChange, setFocusedValue, stopValue, indicatorPlaced }),
    [value, onChange, stopValue, indicatorPlaced],
  );

  return (
    <SegmentedControlContext.Provider value={context}>
      <div
        role="group"
        aria-label={label}
        style={{ appRegion: 'no-drag' }}
        className="flex min-w-0 rounded-full bg-chrome-well p-0.5 shadow-chrome-track"
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
      >
        <div ref={setRail} className="relative flex min-w-0 flex-1 gap-0.5 overflow-hidden">
          <span
            aria-hidden
            data-segment-indicator
            data-placed={indicatorPlaced ? '' : undefined}
            className={cnTw(
              'pointer-events-none absolute top-0 left-0 rounded-full bg-chrome-fill-strong shadow-chrome-raised transition-[transform,width,height] duration-[260ms] ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none',
              !indicatorPlaced && 'hidden',
            )}
            style={
              indicator
                ? {
                    transform: `translate(${indicator.x}px, ${indicator.y}px)`,
                    width: indicator.width,
                    height: indicator.height,
                  }
                : undefined
            }
          />
          {children}
        </div>
      </div>
    </SegmentedControlContext.Provider>
  );
};

type SegmentedControlItemProps = PropsWithChildren<{
  value: string;
  /** A disabled item cannot be picked or focused; the arrow keys, Home and End skip it. */
  disabled?: boolean;
  /** Written as `data-testid` on the item's button. */
  testId?: string;
}>;

const SegmentedControlItem = ({ value, disabled = false, testId, children }: SegmentedControlItemProps) => {
  const context = useContext(SegmentedControlContext);
  if (!context) {
    throw new Error('SegmentedControl.Item must be rendered inside SegmentedControl.Root');
  }

  const pressed = context.value === value;
  const filled = pressed && !context.indicatorPlaced;

  return (
    <button
      type="button"
      data-segment-item
      data-testid={testId}
      data-segment-value={value}
      data-no-app-focus
      data-filled={filled ? '' : undefined}
      aria-pressed={pressed}
      disabled={disabled}
      tabIndex={context.stopValue === value ? 0 : -1}
      className={cnTw(
        'relative flex h-6 min-w-0 flex-auto cursor-pointer items-center justify-center gap-1.5 rounded-full px-2 text-xs font-medium whitespace-nowrap text-chrome-muted transition-[color,background-color] duration-150 select-none hover:text-chrome-text focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-chrome-focus disabled:cursor-default disabled:text-chrome-faint disabled:hover:text-chrome-faint',
        pressed && 'text-chrome-text',
        filled && 'bg-chrome-fill-strong shadow-chrome-raised',
      )}
      onClick={() => {
        if (!pressed) context.onChange(value);
      }}
      onFocus={() => context.setFocusedValue(value)}
    >
      {children}
    </button>
  );
};

/**
 * dot.li's segmented control: one choice out of a few, as pressed buttons in a sunken track. The group is one Tab stop,
 * the arrow keys, Home and End move focus without picking, and a raised indicator slides to the pressed item.
 */
export const SegmentedControl = {
  Root: SegmentedControlRoot,
  Item: SegmentedControlItem,
};
