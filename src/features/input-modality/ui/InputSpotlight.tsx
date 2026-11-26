import { Camera, Search } from 'lucide-react';
import { type KeyboardEvent, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { IconButton } from '@/shared/components';
import { useAnimatedHeight } from '@/shared/hooks';
import { useRxState } from '@/shared/rxstate';
import { TEST_IDS } from '@/shared/test-ids';
import { useTranslation } from '@/shared/translation';
import { cnTw } from '@/shared/utils';
import { type InputSource, routingUseCase } from '@/domains/input-routing';
import {
  type Product,
  DEFAULT_DOTNS_TLD,
  clearRecentProducts,
  dotNsService,
  dotNsUseCase,
  forgetRecentProduct,
  useDisplayedProduct,
  useDotNsTld,
} from '@/domains/product';
import { openDotNsUrlSideEffect } from '@/features/browser';
import { useDropdownNavigation } from '../hooks/useDropdownNavigation';
import { useFilteredProducts } from '../hooks/useFilteredProducts';
import { inputModalityService } from '../service';
import { inputRound, requestRound, resetRound } from '../state/round';
import { inputSurfaceInitialText, inputSurfaceOpen } from '../state/surface';

import { QrScanner } from './QrScanner';
import { ProductItem, SectionHeader, SuggestionList } from './SuggestionList';

// PARKED — product querying. Restore with the rest of the `PARKED` blocks in this feature.
// Also dropped from the imports above: `Paperclip`, `type ChangeEvent`, `useMemo`,
// `type QueryRecipient`, `type RankedCandidate`, `type RoundView`.
// import { type QueryRecipient, type RankedCandidate } from '@/domains/input-routing';
// import { useInputContext } from '../hooks/useInputContext';
// import {
//   attachFiles,
//   composerAttachments,
//   composerDeclined,
//   composerLoading,
//   removeAttachment,
//   resetComposer,
//   revoke,
//   takeAttachments,
// } from '../state/composer';
// import { type DraftAttachment } from '../types';
// import { AttachmentChip } from './AttachmentChip';
// import { AttachmentPicker } from './AttachmentPicker';
// import { CandidateCard } from './CandidateCard';

/**
 * Always mounted in `persistentSlot`, so it reads nothing but the open flag.
 *
 * The surface's context set costs three domain subscriptions (dashboard layout,
 * chat rooms, installed products) plus the router and the selected tab. Holding
 * those open on every screen to serve a closed overlay is exactly the
 * subscription this shell exists to defer — see `react-best-practices`
 * § Defer State Reads to Usage Point.
 *
 * The surface has no shortcut of its own. Cmd/Ctrl+T, Cmd/Ctrl+L and Cmd/Ctrl+K
 * already meant "I want to type an address", and all three raise
 * `focusAddressBarSideEffect`, which this feature handles — so the browser's
 * existing menu accelerators open it, and those fire even when focus is inside a
 * product webview.
 */
export const InputSpotlight = () => {
  const [isOpen] = useRxState(inputSurfaceOpen);

  if (!isOpen) return null;

  return <InputSpotlightSurface />;
};

// Every decision this surface makes — Enter, a confirmed scan, opening a named
// product — is the same decision `state/round.ts` makes for the round on screen,
// so it sources the same settled TLD. Same fallback contract too: a failed read
// routes under `.dot` — wrong off mainnet, but the input routes rather than being
// dropped.
function resolveTld(): Promise<string> {
  return dotNsUseCase.getActiveTld().catch(() => DEFAULT_DOTNS_TLD);
}

const InputSpotlightSurface = () => {
  const { t } = useTranslation();
  const [, setOpen] = useRxState(inputSurfaceOpen);
  const [round] = useRxState(inputRound);
  // Whatever the address bar was showing. Read once — this is the state at mount,
  // and the surface unmounts when it closes.
  const [initialText] = useRxState(inputSurfaceInitialText);

  // Text and its provenance travel together. RFC-0027 § Provenance: confirming a
  // scanned code does not make the user its author, so the source cannot be
  // re-derived from what the field happens to hold — it has to be carried.
  const [entry, setEntry] = useState<{ text: string; source: InputSource }>({ text: initialText, source: 'user' });
  const [scanning, setScanning] = useState(false);
  const fieldRef = useRef<HTMLInputElement>(null);
  const mountedRef = useRef(true);
  const mounted = () => mountedRef.current;

  // PARKED — product querying. The attachment composer and its recipient picker.
  // const [picking, setPicking] = useState<DraftAttachment | null>(null);
  // const fileInputRef = useRef<HTMLInputElement>(null);
  // Closing unmounts this component, so cleanup is the last chance to revoke the
  // object URL `takeAttachments` handed over. State is gone by then; a ref is not.
  // const pickingRef = useRef<DraftAttachment | null>(null);
  // pickingRef.current = picking;
  // const pickerRecipients = useMemo(
  //   () => (picking ? routingUseCase.attachmentRecipientsFor(productIds, picking.routed.category) : []),
  //   [picking, productIds],
  // );

  // Owned here rather than in the results, so the viewfinder and the answers are
  // the same animated box.
  const bodyRef = useAnimatedHeight();
  const { recentProducts, installed, allItems } = useFilteredProducts(entry.text);
  // A typed identifier earns its own row, resolved from the manifest so the user
  // sees the product rather than the string. Suppressed when the suggestion list
  // already names it — the same product twice is not two answers.
  //
  // `useDisplayedProduct` is the host's "committed row, else resolve from chain"
  // read: the chain half lands in an in-memory cache and never in the products
  // table, so naming a product here does not install it. Resolved in the surface
  // rather than in the row so the panel knows whether it has a body — a row that
  // renders nothing must not open an empty one.
  const { data: tld, pending: tldPending, error: tldError } = useDotNsTld();
  const routedProductId = round.kind === 'navigation' && round.routed.type !== 'query' ? round.routed.productId : null;
  const unlistedProductId =
    routedProductId && !allItems.some(product => product.baseName === dotNsService.baseNameOf(routedProductId, tld))
      ? routedProductId
      : null;
  const { data: resolvedProduct } = useDisplayedProduct(unlistedProductId);
  // No ghost until the suffix is known. Tab commits it into the field, and a
  // guessed suffix would be routed against the settled one — the completed name
  // then matches nothing and Enter does nothing, with the wrong text left behind
  // for the user to press Tab on again.
  const ghostSuffix = tldPending || tldError !== null ? '' : inputModalityService.ghostSuffix(entry.text, tld);
  const { activeIndex, handleKeyDown: handleNavKeyDown } = useDropdownNavigation({
    items: allItems,
    onSelect: product => openProduct(product.baseName),
  });

  useEffect(() => {
    fieldRef.current?.focus();
    // Selected rather than appended to, so typing replaces the address the bar
    // handed over — what every address bar does. A no-op when it opened empty.
    fieldRef.current?.select();
  }, []);

  // Everything transient dies with the unmount: `entry` and `scanning` are local
  // state, and the round is module state this owns for the surface's lifetime.
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      resetRound();
      // PARKED — product querying (the composer and the object URLs it holds).
      // resetComposer();
      // const orphan = pickingRef.current;
      // if (orphan) revoke([orphan]);
    };
  }, []);

  // The empty context set is what parks the fan-out: `runRequest` resolves a
  // navigation before it looks at the recipients, so a deeplink still resolves
  // (debounced, as before) while a query reaches nobody — no recipients, no
  // gateway call, no product learns the string.
  //
  // PARKED — product querying: `requestRound(entry.text, productIds, entry.source)`
  // with `productIds` from `useInputContext()`.
  useEffect(() => {
    requestRound(entry.text, [], entry.source);
  }, [entry]);

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);

    return () => document.removeEventListener('keydown', onKey);
  }, [setOpen]);

  // PARKED — product querying.
  // const onFilesPicked = (event: ChangeEvent<HTMLInputElement>) => {
  //   void attachFiles(Array.from(event.target.files ?? []));
  //   // Reset so picking the same file twice still fires a change event.
  //   event.target.value = '';
  // };

  // What the field names once the ghost completion is taken into account —
  // `browse` reads as `browse.dot`. The trim is what makes a trailing space
  // survive the completion: `ghostSuffix` decides on the trimmed text, so
  // appending to the raw text would produce `browse .dot`, which parses to
  // nothing.
  const completedText = ghostSuffix ? entry.text.trim() + ghostSuffix : entry.text;

  /**
   * Enter opens what the field names. An arrowed-to suggestion wins over it —
   * the user pointed.
   *
   * Enter accepts the ghost completion exactly as Tab would, so a bare product
   * name opens. Without it the raw text parses to nothing, is classified as a
   * query, and the query path is parked — the press was silently swallowed.
   *
   * The navigation is resolved from the field rather than from `round`, so that
   * Enter pressed inside the debounce window still works — a navigation is
   * synchronous and needs no round to have landed.
   */
  const onSubmit = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Tab' && ghostSuffix) {
      event.preventDefault();
      setEntry({ text: completedText, source: 'user' });

      return;
    }

    handleNavKeyDown(event);
    if (event.key !== 'Enter' || event.defaultPrevented) return;

    // PARKED — product querying. An attachment named its recipient before
    // anything else could act on Enter.
    // const [first, ...rest] = takeAttachments();
    // if (first) {
    //   // One attachment, one recipient — the rest are dropped, so their preview
    //   // URLs are revoked here. The composer is empty, so nothing else holds them.
    //   revoke(rest);
    //   setPicking(first);
    //
    //   return;
    // }

    // `app`, not "anything but a query": `openProduct` goes through the browser's
    // open-a-product side effect, which is the only variant it can act on. A
    // `chat` or `pocket` would have taken this branch and silently done nothing.
    // Not guarded on the mounting: the user pressed Enter, so the navigation is
    // owed them however slow the read was. Only the close it ends in belongs to
    // this mounting, and `openProduct` is where that is guarded.
    void resolveTld().then(tld => {
      if (routingUseCase.resolveInput(completedText, tld).type === 'app') {
        openProduct(completedText);
      }
    });

    // PARKED — product querying. Enter's last resort was the top-ranked candidate.
    // const top = round.kind === 'query' ? round.candidates[0] : undefined;
    // if (top) onSelectCandidate(top);
  };

  /**
   * Opening the named surface is `product`'s job, reached through the DI side
   * effect the browser feature publishes for exactly this.
   */
  const openProduct = (value: string) => {
    void resolveTld().then(tld => {
      const dotNsUrl = dotNsService.parseDotNsDomain(value, tld);
      if (!dotNsUrl) return;
      void openDotNsUrlSideEffect.apply(dotNsUrl);
      // `inputSurfaceOpen` is module state that outlives this component, and
      // closing unmounts it — so a continuation from a previous opening would
      // close the one on screen now. A slow TLD read plus a second open (opening
      // several tabs in a row) is exactly that race.
      if (!mounted()) return;
      setOpen(false);
    });
  };

  // PARKED — product querying.
  // const onPickRecipient = (productId: string) => {
  //   if (!picking) return;
  //   // `operating-system` — the file picker is an OS surface, so the payload is
  //   // externally authored however the user reached it.
  //   void routingUseCase
  //     .deliverAttachment(productId, picking.routed, 'operating-system', new AbortController().signal)
  //     .catch((error: unknown) => console.error('[input-modality] attachment delivery failed', error));
  //   revoke([picking]);
  //   setPicking(null);
  // };
  //
  // const onSelectCandidate = (candidate: RankedCandidate) => {
  //   void routingUseCase
  //     .selectCandidate(candidate.productId, candidate.content, new AbortController().signal)
  //     .catch((error: unknown) => console.error('[input-modality] selection failed', error));
  //   setOpen(false);
  // };

  /**
   * A confirmed scan does what the same string typed by hand would do.
   *
   * A code naming a product opens it, rather than being parked in the field for
   * the user to press Enter on — they already pressed the button that says what
   * this will do, and asking twice is the gate losing its meaning, not gaining
   * one. Anything else becomes the query it is, carrying `scanned` with it:
   * RFC-0027 § Provenance, satisfying the gate says the host may proceed, never
   * that the user authored it.
   */
  const onScanned = (text: string) => {
    setScanning(false);

    void resolveTld().then(tld => {
      if (!mounted()) return;

      if (routingUseCase.resolveInput(text, tld).type === 'app') {
        openProduct(text);

        return;
      }

      setEntry({ text, source: 'scanned' });
    });
  };

  return createPortal(
    <div
      className="animate-spotlight-backdrop-in fixed inset-0 z-50 flex justify-center bg-black/40 pt-48"
      style={{ appRegion: 'no-drag' }}
      onPointerDown={() => setOpen(false)}
    >
      <div
        role="dialog"
        aria-label={t('feature.inputModality.title')}
        data-testid={TEST_IDS.inputModalitySurface}
        // One card that changes shape, not two that swap. Scanning is a state of
        // this surface, so the width transitions to the viewfinder's while the
        // height animates with the content and the field collapses — a card that
        // resized. Snapping all three at once read as a second modal opening on
        // top, which is the one thing it is not.
        //
        // `max-w-106` is the viewfinder plus its padding, stated as a length so it
        // interpolates; `max-w-fit` would be intrinsic, and the transition would
        // simply not run.
        className={cnTw(
          'animate-spotlight-card-in flex h-fit max-h-[60vh] w-full flex-col overflow-hidden rounded-3xl bg-bg-surface-container shadow-2xl transition-[max-width] duration-300 ease-out',
          scanning ? 'max-w-106' : 'max-w-2xl',
        )}
        onPointerDown={event => event.stopPropagation()}
      >
        {/* Collapsed through a 1fr→0fr grid row rather than `hidden`: the field
            keeps its text and its file input while it is away, and the row's
            height animates instead of vanishing between two frames. */}
        <div
          className={cnTw(
            'grid shrink-0 transition-[grid-template-rows,opacity] duration-300 ease-out',
            scanning ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100',
          )}
        >
          {/* The clipping box carries no padding of its own. `box-sizing: border-box`
              floors a box's height at its own padding, so padding here would leave a
              24px strip above the viewfinder that no amount of `0fr` collapses. */}
          <div className="min-h-0 overflow-hidden">
            <div className="flex min-h-12 items-center gap-2 px-4 py-3">
              {/* PARKED — product querying: the icon pulsed while a round was pending
                  (`round.kind === 'query' && round.pending && 'animate-pulse'`). */}
              <Search aria-hidden className="size-5 shrink-0 text-fg-secondary" />
              {/* The field and the completion it would accept, stacked. An input
                  cannot style part of its own value, so the suffix is drawn by a
                  twin behind it: same box, same typography, the already-typed
                  part transparent so the real caret and text show through it. */}
              <div className="relative min-w-0 flex-1">
                <input
                  ref={fieldRef}
                  value={entry.text}
                  placeholder={t('feature.inputModality.placeholder', { tld })}
                  data-testid={TEST_IDS.inputModalityInput}
                  // The app's global focus ring (index.css) is a box-shadow, which
                  // `outline-none` cannot remove. The card is the focus surface here —
                  // a ring around a borderless field inside it just looks broken.
                  data-no-app-focus
                  className="relative z-10 w-full bg-transparent text-base text-fg-primary outline-none placeholder:text-fg-secondary"
                  onChange={event => setEntry({ text: event.target.value, source: 'user' })}
                  onKeyDown={onSubmit}
                />
                {ghostSuffix && (
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 truncate text-base whitespace-pre text-transparent select-none"
                  >
                    {entry.text}
                    <span data-testid={TEST_IDS.inputModalityGhostSuffix} className="text-fg-secondary">
                      {ghostSuffix}
                    </span>
                  </span>
                )}
              </div>
              {/* PARKED — product querying: the hidden file input and the paperclip
                  that opened it.
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                data-testid={TEST_IDS.inputModalityFileInput}
                onChange={onFilesPicked}
              />
              <button
                type="button"
                aria-label={t('feature.inputModality.attach')}
                className="flex size-8 shrink-0 items-center justify-center rounded-full transition-[background-color,transform] hover:bg-bg-selection-container-hover active:scale-90"
                onClick={() => fileInputRef.current?.click()}
              >
                <Paperclip className="size-4 text-fg-secondary" aria-hidden />
              </button>
              */}
              <IconButton
                label={t('feature.inputModality.scan')}
                data-testid={TEST_IDS.inputModalityScanButton}
                onClick={() => setScanning(true)}
              >
                <Camera aria-hidden />
              </IconButton>
            </div>
          </div>
        </div>

        {/* Both states live in one animated-height container, which is what makes
            the card *morph*: the viewfinder and the results are measured by the
            same observer, so opening the camera animates the height it already
            animates when an answer arrives. Two containers would each animate
            from nothing, which is a swap. */}
        <div ref={bodyRef.containerRef} className="min-h-0 overflow-hidden">
          <div ref={bodyRef.contentRef}>
            {scanning ? (
              <QrScanner onCancel={() => setScanning(false)} onDecoded={onScanned} />
            ) : (
              <SpotlightResults
                suggestions={{ query: entry.text, activeIndex, recentProducts, installed }}
                resolvedProduct={resolvedProduct}
                onOpenProduct={openProduct}
                onOpenTyped={() => openProduct(entry.text)}
                // PARKED — product querying.
                // round={round}
                // noContext={productIds.length === 0 && entry.text.trim().length > 0}
                // picking={picking}
                // pickerRecipients={pickerRecipients}
                // onPickRecipient={onPickRecipient}
                // onSelectCandidate={onSelectCandidate}
              />
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};

type SuggestionsProps = {
  query: string;
  activeIndex: number;
  recentProducts: Product[];
  installed: Product[];
};

type ResultsProps = {
  suggestions: SuggestionsProps;
  onOpenProduct: (baseName: string) => void;
  // The product a typed identifier names, once its manifest has resolved and
  // when it isn't already among the suggestions.
  resolvedProduct: Product | null;
  onOpenTyped: VoidFunction;
  // PARKED — product querying.
  // round: RoundView;
  // The screen contributed nothing AND the user has asked something. No round is
  // started in that case, so this is the only thing that would render.
  // noContext: boolean;
  // picking: DraftAttachment | null;
  // pickerRecipients: QueryRecipient[];
  // onPickRecipient: (productId: string) => void;
  // onSelectCandidate: (candidate: RankedCandidate) => void;
};

const SpotlightResults = ({ suggestions, onOpenProduct, resolvedProduct, onOpenTyped }: ResultsProps) => {
  const { t } = useTranslation();
  // PARKED — product querying. Read here rather than threaded from the surface:
  // this is module state, and the surface used it for nothing but forwarding —
  // which re-rendered the whole card, viewfinder included, on every attachment
  // tick.
  // const [attachments] = useRxState(composerAttachments);
  // const [loadingAttachments] = useRxState(composerLoading);
  // const [declined] = useRxState(composerDeclined);
  const hasSuggestions = suggestions.recentProducts.length > 0 || suggestions.installed.length > 0;
  // PARKED — product querying. Everything the panel can show that isn't a
  // candidate. "Nothing can handle this" is a statement about the whole panel, so
  // it only holds when this is empty — a screen already offering the user
  // somewhere to go has not failed them, whatever the products answered.
  // const hasOtherContent =
  //   hasSuggestions ||
  //   resolvedProduct !== null ||
  //   attachments.length > 0 ||
  //   loadingAttachments ||
  //   picking !== null ||
  //   declined.length > 0;
  // const hasBody = hasOtherContent || round.kind === 'query' || noContext;
  const hasBody = hasSuggestions || resolvedProduct !== null;

  // Deliberately always mounted. Returning null would give the panel an entrance
  // and no exit — the surface's container owns the height animation, so this has
  // to survive the collapse rather than disappear from under it. The border sits
  // here rather than on that container for the same reason: a border is outside
  // the content box, so a collapsed container would leave a hairline behind.
  return (
    <div
      // `[&>*]:shrink-0` is what makes this scroll at all. A flex column shrinks
      // its children to fit before it will overflow, so every row compressed
      // against the max-height and `scrollHeight` never exceeded `clientHeight`
      // — a scroll container with nothing to scroll. Applied to the children
      // rather than to each row so anything added here inherits it.
      className={cnTw(
        'flex max-h-[50vh] min-h-0 flex-col gap-1 overflow-y-auto border-t border-stroke-primary p-2 [&>*]:shrink-0',
        !hasBody && 'hidden',
      )}
    >
      {/* PARKED — product querying: the declined-attachment line, the composer's
          chips, its loading row and the recipient picker.
      {declined.length > 0 && (
        <p className="px-2 py-1 text-xs text-fg-error">
          {t('feature.inputModality.attachmentTooLarge', { fileName: declined.join(', ') })}
        </p>
      )}

      {attachments.map(attachment => (
        <AttachmentChip
          key={attachment.id}
          attachment={attachment}
          removeLabel={t('feature.inputModality.removeAttachment')}
          onRemove={removeAttachment}
        />
      ))}
      {loadingAttachments && (
        <span className="px-2 text-xs text-fg-secondary">{t('feature.inputModality.loadingAttachment')}</span>
      )}

      {picking && <AttachmentPicker attachment={picking} recipients={pickerRecipients} onPick={onPickRecipient} />}
      */}

      {/* The product a typed identifier names, whether or not it is installed —
          seeing what you are about to open beats a line of prose about it. */}
      {resolvedProduct && (
        <div className="flex flex-col gap-1">
          <SectionHeader label={t('feature.inputModality.goTo')} />
          {/* `onOpenTyped`, not this row's identifier: the text may carry a path. */}
          <ProductItem product={resolvedProduct} index={0} isActive={false} query="" onSelect={onOpenTyped} />
        </div>
      )}

      {/* Host answers first: naming a product the user already has beats a
          speculative answer to the same string. */}
      <SuggestionList
        query={suggestions.query}
        activeIndex={suggestions.activeIndex}
        recentProducts={suggestions.recentProducts}
        installed={suggestions.installed}
        onSelect={product => onOpenProduct(product.baseName)}
        onClearRecent={clearRecentProducts}
        onRemoveRecent={forgetRecentProduct}
      />

      {/* PARKED — product querying: the empty-context notice, the candidate cards
          and the round's own status lines.

      An empty context set starts no round at all, so this is the only thing
      that ever renders on a screen with no products on it.
      {noContext && (
        <span data-testid={TEST_IDS.inputModalityNoContext} className="px-3 py-2 text-sm text-fg-secondary">
          {t('feature.inputModality.noContext')}
        </span>
      )}

      {round.kind === 'query' && (
        <>
          {round.candidates.length > 0 && hasSuggestions && (
            <div className="flex h-6 items-center ps-2 pt-1">
              <span className="text-xs font-medium text-fg-secondary">{t('feature.inputModality.fromThisScreen')}</span>
            </div>
          )}
          {inputModalityService.groupByProduct(round.candidates).map((group, index) => (
            <CandidateCard key={group.productId} group={group} index={index} onSelect={onSelectCandidate} />
          ))}
          No fallback to a web search: promoting a query to a URL would let a
          string leave the host unasked.
          {round.candidates.length === 0 && !round.pending && !hasOtherContent && (
            <span data-testid={TEST_IDS.inputModalityNoCandidates} className="px-3 py-2 text-sm text-fg-secondary">
              {t('feature.inputModality.noCandidates')}
            </span>
          )}
          {round.asked > 0 && round.pending && (
            <span className="px-3 py-1 text-xs text-fg-secondary">
              {t('feature.inputModality.asked', { count: round.asked })}
            </span>
          )}
        </>
      )}
      */}
    </div>
  );
};
