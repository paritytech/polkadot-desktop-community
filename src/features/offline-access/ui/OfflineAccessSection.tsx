import { type LucideIcon, Grid2x2, Import, MessageCircle, Scan } from 'lucide-react';

import { Button } from '@/shared/components';
import { TEST_IDS } from '@/shared/test-ids';
import { useTranslation } from '@/shared/translation';
import { type ExecutableKind, type SemVer, manifestService, useDisplayedProduct, useIsPinned } from '@/domains/product';
import { useAvailableUpdates } from '../hooks/useNewerVersionAvailable';
import { openOfflineAccessDialog } from '../state/dialogState';

type Props = {
  productId: string;
};

function showVersion(version: SemVer) {
  return version.some(part => part !== 0);
}

// Per-modality glyph for the update rows — mirrors the Figma design (app = scan
// viewfinder, widget = grid, background services = chat bubble).
const MODALITY_ICON: Record<ExecutableKind, LucideIcon> = {
  app: Scan,
  widget: Grid2x2,
  worker: MessageCircle,
};

type UpdateRowProps = {
  productId: string;
  kind: ExecutableKind;
  fromVersion: SemVer;
  toVersion: SemVer;
};

const UpdateRow = ({ productId, kind, fromVersion, toVersion }: UpdateRowProps) => {
  const { t } = useTranslation();

  // Confirm before any re-download: the button opens the update dialog rather
  // than re-pinning inline (an accidental click stays cancelable).
  const handleUpdate = () => openOfflineAccessDialog({ kind: 'updateExecutable', productId, executableKind: kind });

  const Icon = MODALITY_ICON[kind];

  return (
    <section className="flex items-center gap-4 rounded-xl border border-stroke-secondary bg-bg-surface-container p-3">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-bg-illustration-light text-fg-primary">
        <Icon size={20} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2">
          <span className="size-1.5 shrink-0 rounded-full bg-bg-accent" aria-hidden />
          <span className="text-sm text-fg-primary">
            {t('feature.offlineAccess.section.updateTitle', {
              modality: t(`feature.offlineAccess.section.modality.${kind}`),
            })}
          </span>
        </div>
        {showVersion(fromVersion) && showVersion(toVersion) ? (
          <span className="text-xs font-medium text-fg-tertiary">
            {t('feature.offlineAccess.section.updateReady', {
              fromVersion: manifestService.formatVersion(fromVersion),
              toVersion: manifestService.formatVersion(toVersion),
            })}
          </span>
        ) : null}
      </div>
      <Button data-testid={TEST_IDS.offlineAccessUpdateButton} variant="primary" size="sm" onClick={handleUpdate}>
        {t('feature.offlineAccess.section.update')}
      </Button>
    </section>
  );
};

export const OfflineAccessSection = ({ productId }: Props) => {
  const { t } = useTranslation();
  const { data: product } = useDisplayedProduct(productId);
  const pinned = useIsPinned(productId);
  const updates = useAvailableUpdates(productId);

  if (!product) return null;

  return (
    <div className="flex flex-col gap-4">
      <section className="flex items-center gap-4 rounded-xl border border-stroke-secondary bg-bg-surface-container p-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-bg-illustration-light text-fg-primary">
          <Import size={20} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-sm text-fg-primary">{t('feature.offlineAccess.section.title')}</span>
          <span className="text-xs font-medium text-fg-tertiary">{t('feature.offlineAccess.section.description')}</span>
        </div>
        <Button
          variant={pinned ? 'secondary' : 'primary'}
          size="sm"
          onClick={() => openOfflineAccessDialog({ kind: pinned ? 'remove' : 'enable', productId })}
        >
          {pinned ? t('feature.offlineAccess.section.remove') : t('feature.offlineAccess.section.enable')}
        </Button>
      </section>

      {updates.map(({ kind, fromVersion, toVersion }) => (
        <UpdateRow key={kind} productId={productId} kind={kind} fromVersion={fromVersion} toVersion={toVersion} />
      ))}
    </div>
  );
};
