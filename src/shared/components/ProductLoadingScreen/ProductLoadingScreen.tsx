import { useTranslation } from '@/shared/translation';
import { Spinner } from '../Spinner/Spinner';

type Props = { identifier?: string };

export const ProductLoadingScreen = ({ identifier }: Props) => {
  const { t } = useTranslation();

  const phrase = identifier ? t('widget.webview.loading.reaching', { identifier }) : t('widget.webview.loading.reachingGeneric');

  return (
    <div className="flex h-full w-full items-center justify-center bg-general-muted p-4 text-foreground duration-500 animate-in fade-in">
      <div className="flex w-full max-w-[342px] flex-col items-center gap-10">
        <Spinner size={120} />
        <p className="text-center text-base leading-6 font-medium">{phrase}</p>
      </div>
    </div>
  );
};
