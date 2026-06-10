import { ChevronDown, ChevronUp, Search, X } from 'lucide-react';
import { type KeyboardEvent, type ReactNode, useEffect, useRef } from 'react';

import { TEST_IDS } from '@/shared/test-ids';
import { useTranslation } from '@/shared/translation';
import { cnTw } from '@/shared/utils';
import { useFindControls, useFindSession } from '@/aggregates/find-in-page';

type Props = {
  tabId: string;
};

/**
 * Floating "find in page" bar shown over the top-right of a product tab. Reads the
 * tab's find session from the find-in-page aggregate and issues commands through it;
 * the Webview widget executes the native search and reports matches back.
 *
 * Layout and tokens follow the "Page search" Figma design: a surface-nested pill with
 * a search icon, the term, a fixed-width counter, circular prev/next chevrons, and a
 * close button.
 */
export const FindOverlay = ({ tabId }: Props) => {
  const { t } = useTranslation();
  const session = useFindSession(tabId);
  const { setQuery, next, prev, close } = useFindControls(tabId);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus and select the term whenever the bar opens — including re-presses of
  // Cmd+F while it's already visible. Keying on `openSeq` (bumped by `open()` on
  // every call) is what makes the second Cmd+F re-run focus/select; `visible`
  // alone stays `true → true` and would never re-fire the effect.
  useEffect(() => {
    if (!session.visible) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [session.openSeq, session.visible]);

  if (!session.visible) return null;

  const hasQuery = session.query.length > 0;
  const hasMatches = session.matches > 0;
  const noResults = hasQuery && !hasMatches;

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) prev();
      else next();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  };

  return (
    <div
      data-testid={TEST_IDS.findBar}
      className="animate-find-bar-in absolute top-3 right-3 z-50 flex h-8 items-center gap-2 rounded-lg border border-border-primary bg-bg-surface-nested px-3 shadow-md"
      style={{ appRegion: 'no-drag' }}
    >
      <Search className="size-5 shrink-0 text-fg-secondary" aria-hidden />

      <input
        ref={inputRef}
        type="text"
        spellCheck={false}
        autoCorrect="off"
        data-no-app-focus="true"
        data-testid={TEST_IDS.findInput}
        value={session.query}
        placeholder={t('feature.browser.findPlaceholder')}
        // Some screen readers don't promote `placeholder` to the accessible name,
        // so name the input explicitly. Keep the placeholder for sighted users.
        aria-label={t('feature.browser.findPlaceholder')}
        className="h-full w-44 min-w-0 bg-transparent text-sm text-fg-primary outline-none placeholder:text-fg-secondary"
        onChange={e => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
      />

      {/* The visible counter stays numeric per the design; announce "No results"
          to assistive tech via a live region so keyboard/SR users get parity with
          the sighted `title` tooltip. */}
      <span role="status" aria-live="polite" className="sr-only">
        {noResults ? t('feature.browser.findNoResults') : ''}
      </span>

      <div className="flex shrink-0 items-center gap-1">
        {/* Fixed-width, right-aligned counter keeps the bar from resizing between
            states (e.g. "3/12" vs "0/0"). Numeric, per the design — no wide
            "No results" label. */}
        <span
          data-testid={TEST_IDS.findCount}
          title={noResults ? t('feature.browser.findNoResults') : undefined}
          className="w-14 text-right text-sm text-fg-primary tabular-nums"
        >
          {hasQuery ? t('feature.browser.findCount', { current: session.activeMatchOrdinal, total: session.matches }) : null}
        </span>

        <div className="flex items-center">
          <FindButton
            testId={TEST_IDS.findPrevious}
            ariaLabel={t('feature.browser.findPrevious')}
            disabled={!hasMatches}
            onClick={prev}
          >
            <ChevronUp className="size-4" aria-hidden />
          </FindButton>
          <FindButton testId={TEST_IDS.findNext} ariaLabel={t('feature.browser.findNext')} disabled={!hasMatches} onClick={next}>
            <ChevronDown className="size-4" aria-hidden />
          </FindButton>
        </div>

        <FindButton testId={TEST_IDS.findClose} ariaLabel={t('feature.browser.findClose')} onClick={close}>
          <X className="size-[18px]" aria-hidden />
        </FindButton>
      </div>
    </div>
  );
};

type FindButtonProps = {
  testId: string;
  ariaLabel: string;
  disabled?: boolean;
  onClick: VoidFunction;
  children: ReactNode;
};

const FindButton = ({ testId, ariaLabel, disabled = false, onClick, children }: FindButtonProps) => {
  return (
    <button
      type="button"
      data-testid={testId}
      aria-label={ariaLabel}
      disabled={disabled}
      className={cnTw(
        'flex size-6 shrink-0 items-center justify-center rounded-full text-fg-secondary transition-all duration-100',
        disabled
          ? 'cursor-default opacity-[0.32]'
          : 'cursor-pointer hover:bg-bg-action-secondary-hover hover:text-fg-primary active:scale-90',
      )}
      onClick={onClick}
    >
      {children}
    </button>
  );
};
