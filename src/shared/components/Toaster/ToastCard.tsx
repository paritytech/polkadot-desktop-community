import CircleCheckIcon from '@/shared/assets/images/icons/circle-check.svg?jsx';
import CircleExclamationPointIcon from '@/shared/assets/images/icons/circle-exclamation-point.svg?jsx';
import InfoIcon from '@/shared/assets/images/icons/info.svg?jsx';
import XIcon from '@/shared/assets/images/icons/x.svg?jsx';
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
      {tone === 'success' && <CircleCheckIcon className="size-5 text-chrome-ok" />}
      {tone === 'error' && <CircleExclamationPointIcon className="size-5 text-chrome-err" />}
      {tone === 'info' && <InfoIcon className="size-5 text-chrome-info" />}
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
        <XIcon />
      </IconButton>
    </div>
  );
};
