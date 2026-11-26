import { ChevronDown, ChevronUp, Search, X } from 'lucide-react';
import { type KeyboardEvent, useEffect, useRef } from 'react';

import { IconButton } from '@/shared/components';
import { TEST_IDS } from '@/shared/test-ids';
import { useTranslation } from '@/shared/translation';
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
      className="animate-find-bar-in absolute end-3 top-3 z-50 flex h-control items-center gap-2 rounded-lg border border-stroke-primary bg-bg-surface-nested px-3 shadow-md"
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
        {/* Fixed-width, end-aligned counter keeps the bar from resizing between
            states (e.g. "3/12" vs "0/0"). Numeric, per the design — no wide
            "No results" label. */}
        <span
          data-testid={TEST_IDS.findCount}
          title={noResults ? t('feature.browser.findNoResults') : undefined}
          className="w-14 text-end text-sm text-fg-primary tabular-nums"
        >
          {hasQuery ? t('feature.browser.findCount', { current: session.activeMatchOrdinal, total: session.matches }) : null}
        </span>

        <div className="flex items-center">
          <IconButton
            size="sm"
            data-testid={TEST_IDS.findPrevious}
            label={t('feature.browser.findPrevious')}
            disabled={!hasMatches}
            onClick={prev}
          >
            <ChevronUp aria-hidden />
          </IconButton>
          <IconButton
            size="sm"
            data-testid={TEST_IDS.findNext}
            label={t('feature.browser.findNext')}
            disabled={!hasMatches}
            onClick={next}
          >
            <ChevronDown aria-hidden />
          </IconButton>
        </div>

        <IconButton size="sm" data-testid={TEST_IDS.findClose} label={t('feature.browser.findClose')} onClick={close}>
          <X aria-hidden />
        </IconButton>
      </div>
    </div>
  );
};
