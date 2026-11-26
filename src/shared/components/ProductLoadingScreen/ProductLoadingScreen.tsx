import { type ReactNode } from 'react';

import { useTranslation } from '@/shared/translation';
import { Spinner } from '../Spinner/Spinner';

type PhraseProps = { identifier?: string };

export const ProductLoadingPhrase = ({ identifier }: PhraseProps) => {
  const { t } = useTranslation();

  const phrase = identifier ? t('widget.webview.loading.reaching', { identifier }) : t('widget.webview.loading.reachingGeneric');

  return <p className="text-center text-base font-medium">{phrase}</p>;
};

type Props = {
  /** Only feeds the default message — ignored when `message` is supplied. */
  identifier?: string;
  message?: ReactNode;
  spinnerAnimated?: boolean;
};

export const ProductLoadingScreen = ({ identifier, message, spinnerAnimated = true }: Props) => {
  return (
    <div className="flex h-full w-full items-center justify-center bg-bg-surface-nested p-4 text-fg-primary duration-500 animate-in fade-in">
      <div className="flex w-full max-w-85.5 flex-col items-center gap-10">
        <Spinner size={120} animated={spinnerAnimated} />
        {message ?? <ProductLoadingPhrase identifier={identifier} />}
      </div>
    </div>
  );
};
