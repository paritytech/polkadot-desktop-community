import { Button, Copy, Dialog, ProductHeader } from '@novasamatech/tr-ui';
import JsonView from '@uiw/react-json-view';
import { AlertTriangle, ChevronLeft, Copy as CopyIcon, Info } from 'lucide-react';
import { type CSSProperties, type PropsWithChildren, type ReactNode, memo, useMemo } from 'react';

import { TEST_IDS } from '@/shared/test-ids';
import { useTranslation } from '@/shared/translation';
import { cnTw } from '@/shared/utils';
import { useDisplayedProduct, useDotNsTld } from '@/domains/product';
import { useProductHeaderProps } from '@/widgets/ProductHeader';

/**
 * The pieces every product-request modal is assembled from.
 *
 * A modal picks the parts its request needs and arranges them; it does not restate
 * their markup. That is what keeps eleven request kinds looking like one product and
 * lets a visual change land in one place.
 *
 * Restored from the `signingModalParts` kit that shipped with the host-container
 * binding. What changed is only who supplies the data: the core answers a review with
 * a boolean, so nothing here signs, derives an account, or holds a session.
 */

// Monospace, olive (#728806) keys, every value in the inherited text colour, transparent
// so it sits on the muted code block.
const txArgumentsJsonTheme: CSSProperties = {
  '--w-rjv-font-family': 'inherit',
  '--w-rjv-color': 'currentColor',
  '--w-rjv-background-color': 'transparent',
  '--w-rjv-line-color': 'var(--color-stroke-secondary)',
  '--w-rjv-arrow-color': 'currentColor',
  '--w-rjv-info-color': 'currentColor',
  '--w-rjv-key-string': '#728806',
  '--w-rjv-curlybraces-color': 'currentColor',
  '--w-rjv-colon-color': 'currentColor',
  '--w-rjv-brackets-color': 'currentColor',
  '--w-rjv-quotes-color': '#728806',
  '--w-rjv-quotes-string-color': 'currentColor',
  '--w-rjv-type-string-color': 'currentColor',
  '--w-rjv-type-int-color': 'currentColor',
  '--w-rjv-type-float-color': 'currentColor',
  '--w-rjv-type-bigint-color': 'currentColor',
  '--w-rjv-type-boolean-color': 'currentColor',
  '--w-rjv-type-date-color': 'currentColor',
  '--w-rjv-type-url-color': 'currentColor',
  '--w-rjv-type-null-color': 'currentColor',
  '--w-rjv-type-nan-color': 'currentColor',
  '--w-rjv-type-undefined-color': 'currentColor',
};

const isJsonObject = (value: unknown): value is object => typeof value === 'object' && value !== null;

// Number-valued typed arrays only — bigint-valued ones (BigInt64Array/BigUint64Array) don't
// occur in decoded SCALE call arguments (bigints are plain `bigint`), and excluding them keeps
// the Array.from() result a clean number[].
type NumericTypedArray =
  Int8Array | Uint8Array | Uint8ClampedArray | Int16Array | Uint16Array | Int32Array | Uint32Array | Float32Array | Float64Array;

const isNumericTypedArray = (value: unknown): value is NumericTypedArray =>
  ArrayBuffer.isView(value) &&
  !(value instanceof DataView) &&
  !(value instanceof BigInt64Array) &&
  !(value instanceof BigUint64Array);

// @uiw/react-json-view decides array-vs-object via Array.isArray, so a Uint8Array (or any
// TypedArray) renders as a {0: …, 1: …} map. Recursively convert typed arrays to plain
// arrays so they render as arrays instead.
function normalizeJsonValue(value: unknown): unknown {
  if (isNumericTypedArray(value)) {
    return Array.from(value);
  }
  if (Array.isArray(value)) {
    return value.map(normalizeJsonValue);
  }
  if (isJsonObject(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, val]) => [key, normalizeJsonValue(val)]));
  }

  return value;
}

export const TxArgumentsJson = memo(({ value }: { value: unknown }) => {
  const normalized = useMemo(() => normalizeJsonValue(value), [value]);

  // Wrapped rather than styled: the theme sets `--w-rjv-font-family: inherit`, so the tree
  // takes the monospace treatment from the line it sits in instead of restating it.
  return (
    <RequestMonoLine wrap>
      <JsonView
        value={isJsonObject(normalized) ? normalized : {}}
        style={txArgumentsJsonTheme}
        displayDataTypes={false}
        displayObjectSize={false}
        enableClipboard={false}
        indentWidth={12}
      />
    </RequestMonoLine>
  );
});

TxArgumentsJson.displayName = 'TxArgumentsJson';

/** The muted supporting line under a card or above a footer. */
export const RequestHint = memo(({ children }: PropsWithChildren) => (
  <p className="text-sm leading-5 text-fg-secondary">{children}</p>
));

RequestHint.displayName = 'RequestHint';

/** The bordered card a request's summary sits in. */
export const RequestSummaryCard = memo(({ children }: PropsWithChildren) => (
  <div className="flex flex-col gap-2 rounded-lg border border-stroke-secondary bg-bg-surface-container p-3 shadow-sm">
    {children}
  </div>
));

RequestSummaryCard.displayName = 'RequestSummaryCard';

/** The muted block that holds bytes: call data, a message, a transcript. */
export const RequestCodeBlock = memo(({ children }: PropsWithChildren) => (
  <div className="min-h-9 rounded-lg border border-stroke-primary bg-bg-surface-nested p-3">{children}</div>
));

RequestCodeBlock.displayName = 'RequestCodeBlock';

/** One line of monospace detail. `wrap` for values that must break rather than scroll. */
export const RequestMonoLine = memo(({ wrap = false, children }: PropsWithChildren<{ wrap?: boolean }>) => (
  <div className={cnTw('font-mono text-xs leading-4 text-fg-primary', wrap ? 'break-all' : 'overflow-x-auto whitespace-nowrap')}>
    {children}
  </div>
));

RequestMonoLine.displayName = 'RequestMonoLine';

/** One `label value` pair of a VRF transcript, replayed in the order it was appended. */
export const RequestTranscriptRow = memo(({ label, value }: { label: string; value: string }) => (
  <RequestMonoLine>
    <span className="flex gap-2">
      <span className="shrink-0 text-fg-secondary">{label}</span>
      <span className="min-w-0 break-all">{value}</span>
    </span>
  </RequestMonoLine>
));

RequestTranscriptRow.displayName = 'RequestTranscriptRow';

/** The stacked block a transcript's rows sit in. */
export const RequestTranscriptBlock = memo(({ children }: PropsWithChildren) => (
  <RequestCodeBlock>
    <span className="flex flex-col gap-1">{children}</span>
  </RequestCodeBlock>
));

RequestTranscriptBlock.displayName = 'RequestTranscriptBlock';

/** The back control in the dialog's top-left corner, leaving a details pane. */
export const RequestBackButton = memo(({ onClick }: { onClick: VoidFunction }) => {
  const { t } = useTranslation();

  return (
    <button
      type="button"
      className="absolute start-2.75 top-2.75 flex size-10 items-center justify-center rounded-xl p-2 text-fg-primary transition-colors hover:bg-bg-action-secondary-hover focus-visible:ring-4 focus-visible:ring-stroke-tertiary/35 focus-visible:ring-offset-0 focus-visible:outline-none disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0"
      aria-label={t('common.action.back')}
      onClick={onClick}
    >
      <ChevronLeft className="size-5" />
    </button>
  );
});

RequestBackButton.displayName = 'RequestBackButton';

export const getProductPresentation = (identifier: string, tld: string): { name: string; domain: string } => {
  const domain = identifier;
  const lower = identifier.toLowerCase();

  if (lower.includes('localhost')) {
    return { name: 'Local', domain };
  }

  if (identifier.endsWith(tld)) {
    const withoutDot = identifier.slice(0, -tld.length);
    const leaf = withoutDot.includes('.') ? (withoutDot.split('.').pop() ?? withoutDot) : withoutDot;
    const name = leaf
      .split('-')
      .map(part => (part.length > 0 ? part.charAt(0).toUpperCase() + part.slice(1) : part))
      .join(' ');

    return { name, domain };
  }

  if (domain.length > 28) {
    return { name: `${domain.slice(0, 25)}…`, domain };
  }

  return { name: domain, domain };
};

/** The product asking, with its icon and dotNS domain. Every request opens with it. */
export const RequestProductHeader = memo(({ identifier }: { identifier: string }) => {
  const { data: product } = useDisplayedProduct(identifier);
  const { data: tld } = useDotNsTld();
  const fallback = getProductPresentation(identifier, tld);
  const header = useProductHeaderProps({
    product,
    fallbackName: fallback.name,
    fallbackDomain: fallback.domain,
  });

  return (
    <div className="contents" data-testid={TEST_IDS.requestProductHeader}>
      <ProductHeader {...header} />
    </div>
  );
});

RequestProductHeader.displayName = 'RequestProductHeader';

type RequestAccountDetailsSectionProps = {
  label: string;
  /** Nullish while the address is unknown — renders a placeholder, never a guessed address. */
  address: Nullable<string>;
  /** Lookup failed outright — show an error instead of pending forever. */
  failed?: boolean;
};

/**
 * The signing account, with a copy button.
 *
 * The address is derived by the caller from the product's subtree public key (now that the
 * core persists and exposes it) via `useProductAccountAddress`. `null` renders the pending
 * state while that derivation runs; `failed` renders the unavailable state when the core has
 * not cached the subtree key so no address can be derived.
 */
export const RequestAccountDetailsSection = memo(({ label, address, failed = false }: RequestAccountDetailsSectionProps) => {
  const { t } = useTranslation();

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-base leading-6 text-fg-secondary">{label}</span>
        <Copy value={address ?? ''}>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={address == null}
            aria-label={t('feature.browser.copyAccountAddress')}
          >
            <CopyIcon className="size-4" />
          </Button>
        </Copy>
      </div>
      <RequestCodeBlock>
        <RequestMonoLine>
          {address ?? (
            <span className={failed ? 'text-fg-error' : 'text-fg-secondary'}>
              {failed ? t('feature.browser.accountAddressUnavailable') : t('common.status.loading')}
            </span>
          )}
        </RequestMonoLine>
      </RequestCodeBlock>
    </section>
  );
});

RequestAccountDetailsSection.displayName = 'RequestAccountDetailsSection';

/** A labelled row in the summary card: label left, value right, value truncated. */
export const RequestSummaryRow = memo(({ label, value, testId }: { label: string; value: ReactNode; testId?: string }) => (
  <div className="flex items-start justify-between gap-3" data-testid={testId}>
    <span className="text-base leading-6 text-fg-secondary">{label}</span>
    <span className="max-w-[65%] truncate text-end text-base leading-6 text-fg-primary">{value}</span>
  </div>
));

RequestSummaryRow.displayName = 'RequestSummaryRow';

/** An inline note inside the summary card, with its own separator. Info or warning. */
export const RequestSummaryNote = memo(
  ({ tone, children, testId }: PropsWithChildren<{ tone: 'info' | 'warning'; testId?: string }>) => (
    <>
      <div className="flex items-center gap-2" data-testid={testId}>
        <Info aria-hidden className={cnTw('size-4 shrink-0', tone === 'warning' ? 'text-fg-warning' : 'text-fg-secondary')} />
        <RequestHint>{children}</RequestHint>
      </div>
      <div className="border-t border-stroke-primary" role="separator" />
    </>
  ),
);

RequestSummaryNote.displayName = 'RequestSummaryNote';

/**
 * The context a proof or alias is bound to, named above the warning.
 *
 * Label and value are separate elements rather than one interpolated string: joining them
 * with a colon in JSX would put an untranslated separator in the tree, and the two locales
 * that punctuate differently would have no way to say so.
 *
 * The label's key sits under `aliasPermission` because that is where it was translated into
 * all 13 locales; the proof request shows the same words.
 */
export const RequestContextNote = memo(({ context }: { context: string }) => {
  const { t } = useTranslation();

  return (
    <p className="flex gap-1 text-sm leading-5 font-normal text-fg-secondary">
      <span>{t('widget.productContainerBinding.aliasPermission.requestedContext')}</span>
      <span className="min-w-0 truncate">{context}</span>
    </p>
  );
});

RequestContextNote.displayName = 'RequestContextNote';

/** The standalone warning banner the permission requests end with. */
export const RequestWarningBanner = memo(({ children }: PropsWithChildren) => (
  <div className="flex w-full items-start gap-2 rounded-lg border border-stroke-primary bg-bg-status-warning/10 p-3">
    <AlertTriangle className="mt-0.5 size-5 shrink-0 text-fg-warning" />
    <p className="text-sm leading-5 font-medium text-fg-primary">{children}</p>
  </div>
));

RequestWarningBanner.displayName = 'RequestWarningBanner';

/** A copyable block of monospace detail — arguments, call data, a transcript. */
export const RequestDetailSection = memo(
  ({
    label,
    copyValue,
    copyLabel,
    testId,
    children,
  }: PropsWithChildren<{
    label: string;
    copyValue: string;
    copyLabel: string;
    testId?: string;
  }>) => (
    <section className="flex flex-col gap-3" data-testid={testId}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-base leading-6 text-fg-secondary">{label}</span>
        <Copy value={copyValue}>
          <Button type="button" variant="ghost" size="icon" aria-label={copyLabel}>
            <CopyIcon className="size-4" />
          </Button>
        </Copy>
      </div>
      <RequestCodeBlock>{children}</RequestCodeBlock>
    </section>
  ),
);

RequestDetailSection.displayName = 'RequestDetailSection';

type RequestFooterProps = {
  cancelLabel: string;
  primaryLabel: string;
  primaryTestId?: string;
  primaryDisabled?: boolean;
  onCancel: VoidFunction;
  onPrimary: VoidFunction;
};

/** The two-button footer: deny left, the action right. */
export const RequestFooter = memo(
  ({ cancelLabel, primaryLabel, primaryTestId, primaryDisabled, onCancel, onPrimary }: RequestFooterProps) => (
    <div className="shrink-0">
      <Dialog.Footer>
        <div className="flex w-full min-w-0 flex-row gap-2">
          <div className="min-w-0 flex-1">
            <Button type="button" variant="outline" fullWidth data-testid={TEST_IDS.productRequestDeny} onClick={onCancel}>
              {cancelLabel}
            </Button>
          </div>
          <div className="min-w-0 flex-1">
            <Button type="button" fullWidth disabled={primaryDisabled} data-testid={primaryTestId} onClick={onPrimary}>
              {primaryLabel}
            </Button>
          </div>
        </div>
      </Dialog.Footer>
    </div>
  ),
);

RequestFooter.displayName = 'RequestFooter';
