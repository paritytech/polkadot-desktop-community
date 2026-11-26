import { ChevronLeft } from 'lucide-react';
import { type PropsWithChildren, type ReactNode } from 'react';

import { useTranslation } from '@/shared/translation';
import { cnTw } from '@/shared/utils';
import { IconButton } from '../IconButton/IconButton';

type Props = PropsWithChildren<{
  icon?: ReactNode;
  subtitle?: ReactNode;
  onBack?: VoidFunction;
  /**
   * `page` (default) aligns the header with a content body's `px-4` (`ps-4`).
   * `list` matches a side-menu list header — chat's leading inset (`ps-2`).
   */
  variant?: 'page' | 'list';
}>;

export const SettingsHeader = ({ icon, subtitle, onBack, variant = 'page', children }: Props) => {
  const { t } = useTranslation();

  return (
    <header
      className={cnTw(
        'flex min-h-12 w-full shrink-0 items-center gap-2 self-stretch bg-bg-surface-container py-2 pe-2 text-fg-primary',
        variant === 'list' ? 'ps-2' : 'ps-4',
      )}
    >
      {onBack ? (
        <IconButton label={t('common.action.back')} onClick={onBack}>
          <ChevronLeft />
        </IconButton>
      ) : null}
      {icon}
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-sm font-semibold">{children}</span>
        {subtitle ? <span className="text-xs text-fg-secondary">{subtitle}</span> : null}
      </div>
    </header>
  );
};
