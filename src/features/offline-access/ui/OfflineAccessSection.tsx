import { useTranslation } from '@/shared/translation';
import { useDisplayedProduct, useIsPinned, useOfflineCacheStatus } from '@/domains/product';
import { openOfflineAccessDialog } from '../state/dialogState';

type Props = {
  productId: string;
};

export const OfflineAccessSection = ({ productId }: Props) => {
  const { t } = useTranslation();
  const { data: product } = useDisplayedProduct(productId);
  const pinned = useIsPinned(productId);
  const status = useOfflineCacheStatus(productId);

  if (!product) return null;

  return (
    <section className="flex flex-col gap-2 py-3">
      <header className="text-sm font-semibold text-fg-primary">{t('feature.offlineAccess.section.title')}</header>
      <p className="text-sm text-fg-secondary">{t('feature.offlineAccess.section.description')}</p>
      {pinned && status === 'preparing' ? (
        <p className="text-sm text-fg-secondary">{t('feature.offlineAccess.status.preparing')}</p>
      ) : null}
      {pinned && status === 'ready' ? <p className="text-sm text-fg-success">{t('feature.offlineAccess.status.ready')}</p> : null}
      {pinned && status === 'failed' ? <p className="text-sm text-fg-error">{t('feature.offlineAccess.status.failed')}</p> : null}
      <div className="flex gap-3">
        <button
          className="text-fg-accent text-sm underline"
          onClick={() => openOfflineAccessDialog({ kind: pinned ? 'remove' : 'enable', productId })}
        >
          {pinned ? t('feature.offlineAccess.section.remove') : t('feature.offlineAccess.section.enable')}
        </button>
        {pinned && status === 'failed' ? (
          <button
            className="text-fg-accent text-sm underline"
            onClick={() => openOfflineAccessDialog({ kind: 'enable', productId })}
          >
            {t('feature.offlineAccess.status.retry')}
          </button>
        ) : null}
      </div>
    </section>
  );
};
