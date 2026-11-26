import { CircleAlert, CircleCheck, Info, X } from 'lucide-react';

import { useTranslation } from '@/shared/translation';
import { Button } from '../Button/Button';
import { IconButton } from '../IconButton/IconButton';

export type ToastTone = 'success' | 'error' | 'info' | 'message';

type ToastCardProps = {
  tone: ToastTone;
  title: string;
  description?: string;
  action?: { label: string; onClick: VoidFunction };
  onClose: VoidFunction;
};

export const ToastCard = ({ tone, title, description, action, onClose }: ToastCardProps) => {
  const { t } = useTranslation();

  return (
    <div
      className="flex w-full animate-toast-in items-center gap-3 rounded-2xl bg-(image:--chrome-glass) px-3 py-2 text-chrome-text shadow-chrome-pop backdrop-blur-2xl backdrop-saturate-150 motion-reduce:[animation-duration:0.01ms]"
      style={{ appRegion: 'no-drag' }}
    >
      {tone === 'success' && <CircleCheck className="size-5 text-chrome-ok" aria-hidden />}
      {tone === 'error' && <CircleAlert className="size-5 text-chrome-err" aria-hidden />}
      {tone === 'info' && <Info className="size-5 text-chrome-info" aria-hidden />}
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="line-clamp-2 text-sm font-semibold">{title}</span>
        {description && <span className="text-xs text-chrome-muted">{description}</span>}
      </div>
      {action && (
        <Button size="sm" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
      <IconButton size="sm" label={t('common.aria.close')} onClick={onClose}>
        <X />
      </IconButton>
    </div>
  );
};
