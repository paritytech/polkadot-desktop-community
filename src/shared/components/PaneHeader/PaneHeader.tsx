import { type PropsWithChildren, type ReactNode } from 'react';

import ChevronLeftIcon from '@/shared/assets/images/icons/chevron-left.svg?jsx';
import { useTranslation } from '@/shared/translation';
import { cnTw } from '@/shared/utils';
import { IconButton } from '../IconButton/IconButton';

type Props = PropsWithChildren<{
  icon?: ReactNode;
  subtitle?: ReactNode;
  onBack?: VoidFunction;
  /**
   * `page` (default) aligns the header with a content body's `px-4` (`ps-4`).
   * `list` matches the list pane header's leading inset (`ps-2`).
   */
  variant?: 'page' | 'list';
  actions?: ReactNode;
}>;

export const PaneHeader = ({ icon, subtitle, onBack, variant = 'page', actions, children }: Props) => {
  const { t } = useTranslation();

  return (
    <header
      className={cnTw(
        'flex min-h-12 w-full shrink-0 items-center gap-2 self-stretch py-2 pe-2 text-fg-primary',
        variant === 'list' ? 'ps-2' : 'ps-4',
      )}
    >
      {onBack ? (
        <IconButton label={t('common.action.back')} onClick={onBack}>
          <ChevronLeftIcon className="rtl:-scale-x-100" />
        </IconButton>
      ) : null}
      {icon}
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-semibold">{children}</span>
        {subtitle ? <span className="truncate text-xs text-fg-secondary">{subtitle}</span> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-1">{actions}</div> : null}
    </header>
  );
};
