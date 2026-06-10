import { Button, Dialog, toastError } from '@novasamatech/tr-ui';
import { Clock } from 'lucide-react';
import { useCallback, useRef } from 'react';

import SigningPhoneMock from '@/shared/assets/images/signing-phone-mock.svg?jsx';
import { useTranslation } from '@/shared/translation';
import { useSubmitError } from '@/domains/application';

import { SubmitErrorAlert, signingDialogHeadingClassName, useSigningCountdown } from './signingModalParts';

type PolkadotAppWaitingMode = 'signing' | 'allocation';

type Props = {
  mode?: PolkadotAppWaitingMode;
  open: boolean;
  lifetimeMs: number | null;
  onCancel: VoidFunction;
  onTimeout: VoidFunction;
};

export const SignPolkadotAppModal = ({ mode = 'signing', open, lifetimeMs, onCancel, onTimeout }: Props) => {
  const { t } = useTranslation();
  const rejectionToastShownRef = useRef(false);
  const isAllocation = mode === 'allocation';
  const submitError = useSubmitError(open && !isAllocation);

  const dismissWithRejectedToast = useCallback(() => {
    if (rejectionToastShownRef.current) {
      return;
    }
    rejectionToastShownRef.current = true;
    toastError({
      title: isAllocation
        ? t('widget.productContainerBinding.allocationRequest.allocationRejected')
        : t('feature.browser.transactionSigningRejected'),
    });
    onCancel();
  }, [isAllocation, onCancel, t]);

  const handleExpire = useCallback(() => {
    toastError({
      title: t('feature.browser.signingTimedOutTitle'),
      description: t('feature.browser.signingTimedOutBody'),
      duration: 10_000,
    });
    onTimeout();
  }, [t, onTimeout]);

  const countdownDisplay = useSigningCountdown(lifetimeMs, handleExpire);
  const showValidFor = countdownDisplay !== null;

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      dismissWithRejectedToast();
    }
  };

  const handleInteractOutside = (event: { preventDefault: () => void }) => {
    event.preventDefault();
  };

  return (
    <Dialog modal open={open} onOpenChange={handleOpenChange}>
      <Dialog.Content
        aria-describedby={undefined}
        showCloseButton
        variant="tall"
        onOpenAutoFocus={event => event.preventDefault()}
        onInteractOutside={handleInteractOutside}
      >
        <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col gap-2">
          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
            <Dialog.Title asChild>
              <h2 className={signingDialogHeadingClassName}>
                {isAllocation
                  ? t('widget.productContainerBinding.allocationRequest.title')
                  : t('feature.browser.signPolkadotAppTitle')}
              </h2>
            </Dialog.Title>
            <div className="flex flex-col gap-0 text-base leading-6 font-normal text-text-primary">
              <p className="mb-0 leading-6">
                {isAllocation
                  ? t('widget.productContainerBinding.allocationRequest.polkadotAppLine1')
                  : t('feature.browser.signPolkadotAppLine1')}
              </p>
              <p className="leading-6">
                {isAllocation
                  ? t('widget.productContainerBinding.allocationRequest.polkadotAppLine2')
                  : t('feature.browser.signPolkadotAppLine2')}
              </p>
            </div>
            {submitError && <SubmitErrorAlert title={submitError.title} description={submitError.description} />}
            <div className="pointer-events-none mx-auto w-[234px] pt-6 pb-5 [&_*]:pointer-events-none">
              <div className="relative" aria-hidden>
                <SigningPhoneMock className="h-[309px] w-full" />
                {showValidFor ? (
                  <div
                    className="absolute top-4 left-1/2 z-10 inline-flex h-6 min-h-6 w-fit max-w-[calc(100%-1rem)] -translate-x-1/2 items-center gap-1 rounded-2xl border border-border-primary bg-bg-surface-container px-2 py-0 text-xs leading-4 font-medium text-text-primary"
                    aria-live="polite"
                  >
                    <Clock className="size-3.5 shrink-0 text-text-primary" aria-hidden />
                    <span className="whitespace-nowrap">
                      {t('feature.browser.signPolkadotAppValidFor', { time: countdownDisplay })}
                    </span>
                  </div>
                ) : null}
                <p className="absolute top-[172px] left-1/2 z-10 -translate-x-1/2 text-center text-xs leading-4 font-medium whitespace-nowrap text-text-primary">
                  {t('feature.browser.signPolkadotAppDeviceLabel')}
                </p>
              </div>
            </div>
            <div className="flex min-h-9 justify-center px-4 py-1">
              <a
                href="https://polkadot.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg px-4 py-1 text-sm leading-5 font-semibold text-fg-link"
              >
                {t('feature.browser.havingTroubleSigning')}
              </a>
            </div>
          </div>
          <div className="shrink-0 pt-4">
            <Dialog.Footer>
              <Button type="button" variant="outline" fullWidth onClick={dismissWithRejectedToast}>
                {t('common.action.cancel')}
              </Button>
            </Dialog.Footer>
          </div>
        </div>
      </Dialog.Content>
    </Dialog>
  );
};
