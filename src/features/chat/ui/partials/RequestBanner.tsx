import { type ReactNode } from 'react';
import { FormattedMessage } from 'react-intl';

import { Button } from '@/shared/components';
import { useTranslation } from '@/shared/translation';

type RequestBannerProps = {
  name: string;
  /** `top` — rounded pill card under the header (message hidden). `bottom` — full-width bar replacing the input (message revealed). */
  placement: 'top' | 'bottom';
  disabled?: boolean;
  acceptTestId?: string;
  onAccept: VoidFunction;
  onDecline: VoidFunction;
};

const boldName = (chunks: ReactNode) => <span className="font-semibold text-fg-primary">{chunks}</span>;

export const RequestBanner = ({ name, placement, disabled, acceptTestId, onAccept, onDecline }: RequestBannerProps) => {
  const { t } = useTranslation();

  const content = (
    <>
      <p className="min-w-0 flex-1 text-sm text-fg-secondary">
        <FormattedMessage id="feature.chat.request.banner" values={{ name, b: boldName, br: () => <br /> }} />
      </p>
      <div className="flex shrink-0 items-center gap-2">
        <Button size="sm" disabled={disabled} onClick={onDecline}>
          {t('feature.chat.request.decline')}
        </Button>
        <Button variant="primary" size="sm" disabled={disabled} data-testid={acceptTestId} onClick={onAccept}>
          {t('feature.chat.request.accept')}
        </Button>
      </div>
    </>
  );

  if (placement === 'bottom') {
    return <div className="flex shrink-0 items-center gap-3 border-t border-stroke-primary px-4 py-3">{content}</div>;
  }

  return (
    <div className="shrink-0 px-4 py-3">
      <div className="flex items-center gap-3 rounded-full border border-stroke-primary bg-bg-surface-container px-4 py-3">
        {content}
      </div>
    </div>
  );
};
