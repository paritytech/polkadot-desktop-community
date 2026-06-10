import { Button, Copy, Dialog, ProductHeader } from '@novasamatech/tr-ui';
import { AlertCircle, Copy as CopyIcon } from 'lucide-react';
import { type ReactNode, memo, useEffect, useRef, useState } from 'react';

import { TEST_IDS } from '@/shared/test-ids';
import { useTranslation } from '@/shared/translation';
import { type HexString } from '@/shared/types';
import { useDisplayedProduct, useProductHeaderProps } from '@/domains/product';

export const normalizeCallSegment = (segment: string): string => segment.replace(/[_-]/g, '').toLowerCase();

export function stringifyTxArguments(value: unknown): string {
  const encoded = JSON.stringify(value, (_, v: unknown) => (typeof v === 'bigint' ? v.toString() : v), 4);
  return encoded === undefined ? '{}' : encoded;
}

const JSON_KEY_RE = /"((?:[^"\\]|\\.)*)"(?=\s*:)/g;

export const JsonWithHighlightedKeys = ({ text }: { text: string }): ReactNode => {
  const safeText = typeof text === 'string' ? text : '{}';
  JSON_KEY_RE.lastIndex = 0;
  const nodes: ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  let i = 0;
  while ((match = JSON_KEY_RE.exec(safeText)) !== null) {
    if (match.index > last) {
      nodes.push(<span key={i++}>{safeText.slice(last, match.index)}</span>);
    }
    nodes.push(
      <span key={i++} className="text-[#728806]">
        {match[0]}
      </span>,
    );
    last = match.index + match[0].length;
  }
  if (last < safeText.length) {
    nodes.push(<span key={i++}>{safeText.slice(last)}</span>);
  }
  return <div className={`${signingDetailMonoTextClassName} break-all whitespace-pre-wrap`}>{nodes}</div>;
};

export const signingSummarySectionClassName =
  'flex flex-col gap-2 rounded-lg border border-border-secondary bg-bg-surface-container p-3';

export const signingRawMessageCardClassName =
  'flex flex-col gap-3 rounded-lg border border-border-secondary bg-bg-surface-container p-3 shadow-sm';

export const signingDetailCodeBlockClassName = 'min-h-9 rounded-lg border border-general-border bg-general-muted p-3';

export const signingDetailMonoTextClassName = 'font-mono text-xs leading-4 text-text-primary';

export const signingDetailMonoSingleLineClassName = `${signingDetailMonoTextClassName} overflow-x-auto whitespace-nowrap`;

type SigningAccountDetailsSectionProps = {
  accountIndex: number;
  address: string;
};

export const SigningAccountDetailsSection = memo(({ accountIndex, address }: SigningAccountDetailsSectionProps) => {
  const { t } = useTranslation();

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-base leading-6 text-text-secondary">
          {t('feature.browser.signingByAppAccount', { index: accountIndex })}
        </span>
        <Copy value={address}>
          <Button type="button" variant="ghost" size="icon" aria-label={t('feature.browser.copyAccountAddress')}>
            <CopyIcon className="size-4" />
          </Button>
        </Copy>
      </div>
      <div className={signingDetailCodeBlockClassName}>
        <div className={signingDetailMonoSingleLineClassName}>{address}</div>
      </div>
    </section>
  );
});

SigningAccountDetailsSection.displayName = 'SigningAccountDetailsSection';

export const signingDialogCornerControlClassName =
  'absolute top-[11px] flex size-10 items-center justify-center rounded-xl p-2 text-fg-primary transition-colors hover:bg-bg-action-secondary-hover focus-visible:ring-[4px] focus-visible:ring-border-tertiary/35 focus-visible:ring-offset-0 focus-visible:outline-none disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*="size-"])]:size-5';

export const signingDialogHeadingClassName = 'text-2xl leading-8 font-semibold text-text-primary';

export const getProductPresentation = (identifier: string): { name: string; domain: string } => {
  const domain = identifier;
  const lower = identifier.toLowerCase();

  if (lower.includes('localhost')) {
    return { name: 'Local', domain };
  }

  if (identifier.endsWith('.dot')) {
    const withoutDot = identifier.slice(0, -4);
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

export const humanizeCallSegment = (segment: string): string =>
  segment
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .split(/[\s._]+/)
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');

/**
 * Decode a SCALE-encoded mortal era and return the period (in blocks).
 * Immortal era (`0x00`) returns `null`.
 */
export const decodeMortalEraPeriod = (eraHex: HexString): number | null => {
  const raw = eraHex.startsWith('0x') ? eraHex.slice(2) : eraHex;

  // Immortal era
  if (raw === '00' || raw.length === 0) return null;

  // Mortal era is 2 bytes, little-endian
  const byte0 = parseInt(raw.slice(0, 2), 16);
  const byte1 = parseInt(raw.slice(2, 4), 16);
  const encoded = byte0 | (byte1 << 8);

  const period = 2 << (encoded % (1 << 4));

  return period;
};

/**
 * Calculate the total signing lifetime in milliseconds from era and block time.
 */
export const calcSigningLifetimeMs = (eraHex: HexString, blockTimeMs: bigint): number | null => {
  const period = decodeMortalEraPeriod(eraHex);
  if (period === null) return null;

  return period * Number(blockTimeMs);
};

/**
 * Format milliseconds as mm:ss.
 */
export const formatCountdown = (ms: number): string => {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

/**
 * Countdown hook that ticks every second and calls `onExpire` when time runs out.
 * Returns the formatted time string or `null` if lifetime is unknown.
 */
export const useSigningCountdown = (lifetimeMs: number | null, onExpire: VoidFunction): string | null => {
  const [remaining, setRemaining] = useState(lifetimeMs);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    if (lifetimeMs === null) return;

    setRemaining(lifetimeMs);
    const start = Date.now();

    const tick = () => {
      const elapsed = Date.now() - start;
      const left = lifetimeMs - elapsed;

      if (left <= 0) {
        setRemaining(0);
        onExpireRef.current();
      } else {
        setRemaining(left);
      }
    };

    const id = setInterval(tick, 1000);

    return () => clearInterval(id);
  }, [lifetimeMs]);

  if (remaining === null) return null;

  return formatCountdown(remaining);
};

export const SigningProductHeader = memo(({ identifier }: { identifier: string }) => {
  const { data: product } = useDisplayedProduct(identifier);
  const fallback = getProductPresentation(identifier);
  const header = useProductHeaderProps({
    product,
    fallbackName: fallback.name,
    fallbackDomain: fallback.domain,
  });

  return <ProductHeader {...header} />;
});

SigningProductHeader.displayName = 'SigningProductHeader';

type SigningPolkadotAppHintProps = {
  variant?: 'transaction' | 'rawMessage';
};

export const SigningPolkadotAppHint = memo(({ variant = 'transaction' }: SigningPolkadotAppHintProps) => {
  const { t } = useTranslation();

  const hintKey = variant === 'rawMessage' ? 'feature.browser.polkadotAppRawMessageHint' : 'feature.browser.polkadotAppHint';

  return <div className="text-sm leading-5 text-text-secondary">{t(hintKey)}</div>;
});

SigningPolkadotAppHint.displayName = 'SigningPolkadotAppHint';

type SigningReviewFooterProps = {
  cancelLabel: string;
  primaryLabel: string;
  primaryPendingLabel: string;
  pending: boolean;
  primaryDisabled?: boolean;
  onPrimary: VoidFunction;
};

export const SigningReviewFooter = memo(
  ({ cancelLabel, primaryLabel, primaryPendingLabel, pending, primaryDisabled, onPrimary }: SigningReviewFooterProps) => (
    <div className="shrink-0">
      <Dialog.Footer>
        <div className="flex w-full min-w-0 flex-row gap-2 sm:gap-2">
          <div className="min-w-0 flex-1">
            <Dialog.Close asChild>
              <Button type="button" variant="outline" fullWidth>
                {cancelLabel}
              </Button>
            </Dialog.Close>
          </div>
          <div className="min-w-0 flex-1">
            <Button type="button" fullWidth disabled={pending || primaryDisabled} onClick={onPrimary}>
              {pending ? primaryPendingLabel : primaryLabel}
            </Button>
          </div>
        </div>
      </Dialog.Footer>
    </div>
  ),
);

SigningReviewFooter.displayName = 'SigningReviewFooter';

type SubmitErrorAlertProps = {
  title: string;
  description: string;
};

export const SubmitErrorAlert = memo(({ title, description }: SubmitErrorAlertProps) => (
  <div
    data-testid={TEST_IDS.submitErrorAlert}
    className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950"
  >
    <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
    <div className="flex flex-col gap-0.5">
      <p className="text-sm leading-5 font-medium text-amber-800 dark:text-amber-200">{title}</p>
      <p className="text-xs leading-4 text-amber-700 dark:text-amber-300">{description}</p>
    </div>
  </div>
));

SubmitErrorAlert.displayName = 'SubmitErrorAlert';
