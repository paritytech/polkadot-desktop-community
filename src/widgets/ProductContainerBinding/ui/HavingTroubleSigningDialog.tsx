import { AlertDialog } from '@novasamatech/tr-ui';
import { ChevronRight, X } from 'lucide-react';
import { memo } from 'react';

import { useTranslation } from '@/shared/translation';

const TROUBLESHOOTING_GUIDE_URL = 'https://docs.polkadot.com/apps';

type Props = {
  open: boolean;
  onCancel: VoidFunction;
  onReload: VoidFunction;
};

export const HavingTroubleSigningDialog = memo(({ open, onCancel, onReload }: Props) => {
  const { t } = useTranslation();

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      onCancel();
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialog.Content>
        <button
          type="button"
          aria-label={t('common.aria.close')}
          className="absolute top-[11px] right-[11px] flex size-10 items-center justify-center rounded-xl p-2 text-fg-primary transition-colors hover:bg-bg-action-secondary-hover focus-visible:ring-[2px] focus-visible:ring-border-tertiary/35 focus-visible:ring-offset-0 focus-visible:outline-none"
          onClick={onCancel}
        >
          <X className="size-5" aria-hidden />
        </button>

        <div className="flex flex-col gap-2">
          <AlertDialog.Header>
            <AlertDialog.Title>
              <span className="text-[length:var(--text-heading-m-size)] leading-[length:var(--text-heading-m-line-height)] font-semibold text-text-primary">
                {t('feature.browser.havingTroubleSigningDialog.title')}
              </span>
            </AlertDialog.Title>
            <AlertDialog.Description>
              <span className="text-base leading-6 font-normal text-text-primary">
                {t('feature.browser.havingTroubleSigningDialog.description')}
              </span>
            </AlertDialog.Description>
          </AlertDialog.Header>

          <div className="flex h-9 w-full items-center justify-center">
            <a
              href={TROUBLESHOOTING_GUIDE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 items-center gap-0 rounded-lg px-4 py-1 text-sm leading-5 font-semibold text-fg-link transition-colors hover:text-fg-link-hover"
            >
              {t('feature.browser.havingTroubleSigningDialog.troubleshootingGuide')}
              <ChevronRight className="size-4" aria-hidden />
            </a>
          </div>

          <AlertDialog.Footer>
            <AlertDialog.Cancel fullWidth onClick={onCancel}>
              <span className="text-base leading-6 font-medium">{t('common.action.cancel')}</span>
            </AlertDialog.Cancel>
            <AlertDialog.Action fullWidth onClick={onReload}>
              <span className="text-base leading-6 font-medium">{t('feature.browser.havingTroubleSigningDialog.reload')}</span>
            </AlertDialog.Action>
          </AlertDialog.Footer>
        </div>
      </AlertDialog.Content>
    </AlertDialog>
  );
});

HavingTroubleSigningDialog.displayName = 'HavingTroubleSigningDialog';
