import { useTranslation } from '@/shared/translation';

export const Web3SummitEndedScreen = () => {
  const { t } = useTranslation();

  return (
    <main
      aria-label={t('common.web3summitEnded.ariaLabel')}
      className="flex h-full w-full items-center justify-center bg-bg-surface-main px-6 duration-500 animate-in fade-in"
    >
      <div className="flex max-w-4xl flex-col items-center text-center">
        <h1 className="w-full text-[48px] leading-[64px] font-semibold tracking-[-1px] text-fg-primary">
          {t('common.web3summitEnded.title')}
        </h1>
        <p className="w-full text-[48px] leading-[64px] font-semibold tracking-[-1px] text-fg-primary">
          {t('common.web3summitEnded.subtitle')}
        </p>
      </div>
    </main>
  );
};
