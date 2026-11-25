import { Check, Copy, X } from 'lucide-react';
import { useEffect, useState } from 'react';

import { useTranslation } from '@/shared/translation';
import { IconButton } from '../IconButton/IconButton';

type CopyStatus = 'idle' | 'copied' | 'failed';

type CopyButtonProps = {
  value: string;
  label: string;
  disabled?: boolean;
};

const FEEDBACK_DURATION_MS = 1200;

export const CopyButton = ({ value, label, disabled }: CopyButtonProps) => {
  const { t } = useTranslation();
  const [status, setStatus] = useState<CopyStatus>('idle');
  const [pressCount, setPressCount] = useState(0);

  useEffect(() => {
    if (status === 'idle') return;

    const timeout = setTimeout(() => setStatus('idle'), FEEDBACK_DURATION_MS);

    return () => clearTimeout(timeout);
  }, [status, pressCount]);

  const handleClick = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setStatus('copied');
    } catch {
      setStatus('failed');
    }
    setPressCount(count => count + 1);
  };

  return (
    <IconButton
      disabled={disabled}
      label={status === 'copied' ? t('common.action.copied') : status === 'failed' ? t('common.action.copyFailed') : label}
      size="sm"
      onClick={handleClick}
    >
      {status === 'copied' && <Check aria-hidden className="size-4" />}
      {status === 'failed' && <X aria-hidden className="size-4" />}
      {status === 'idle' && <Copy aria-hidden className="size-4" />}
    </IconButton>
  );
};
