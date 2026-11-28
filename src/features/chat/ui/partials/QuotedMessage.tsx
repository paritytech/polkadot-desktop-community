import { type ReactNode } from 'react';

import { IconButton } from '@/shared/components';
import { XIcon } from '@/shared/icons';
import { useTranslation } from '@/shared/translation';
import { cnTw } from '@/shared/utils';

type Props = {
  title?: ReactNode;
  text: ReactNode;
  media?: ReactNode;
  tone?: 'default' | 'inverted';
  testId?: string;
  onDismiss?: VoidFunction;
};

export const QuotedMessage = ({ title, text, media, tone = 'default', testId, onDismiss }: Props) => {
  const { t } = useTranslation();

  return (
    <div
      data-testid={testId}
      className={cnTw(
        'flex gap-2 rounded-xl border-s-4 px-3 py-2',
        tone === 'default' && 'border-stroke-tertiary bg-bg-surface-container text-fg-primary',
        tone === 'inverted' && 'border-fg-secondary-inverted bg-bg-surface-nested-inverted text-fg-primary-inverted',
      )}
    >
      {media}
      <div className="flex min-w-0 flex-1 flex-col justify-center">
        {title ? <p className="truncate text-xs font-semibold">{title}</p> : null}
        <p className="line-clamp-2 text-xs">{text}</p>
      </div>
      {onDismiss ? (
        <IconButton size="sm" label={t('common.aria.close')} onClick={onDismiss}>
          <XIcon />
        </IconButton>
      ) : null}
    </div>
  );
};
