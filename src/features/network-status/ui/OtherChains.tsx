import { ChevronDown } from 'lucide-react';
import { type FC, type PropsWithChildren } from 'react';

import { TEST_IDS } from '@/shared/test-ids';
import { useTranslation } from '@/shared/translation';

type Props = {
  count: number;
};

// Closing keeps the body shown while it folds away; opening shows it at once, so what is in it takes focus while it
// unfolds.
export const OtherChains: FC<PropsWithChildren<Props>> = ({ count, children }) => {
  const { t } = useTranslation();

  return (
    <details
      data-testid={TEST_IDS.networkOtherChains}
      className="group [interpolate-size:allow-keywords] details-content:h-0 details-content:overflow-clip details-content:[overflow-clip-margin:--spacing(1)] open:details-content:h-auto motion-safe:details-content:transition-[height,content-visibility] motion-safe:details-content:transition-discrete motion-safe:details-content:duration-260 motion-safe:details-content:ease-chrome motion-safe:open:details-content:transition-[height]"
    >
      <summary
        data-testid={TEST_IDS.networkOtherChainsSummary}
        data-no-app-focus
        className="-mx-1 flex min-h-control w-fit cursor-pointer list-none items-center gap-1 rounded-lg px-1 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-chrome-focus [&::-webkit-details-marker]:hidden"
      >
        {t('feature.networkStatus.otherChains', { count })}
        <ChevronDown
          aria-hidden
          className="size-3.5 flex-none group-open:rotate-180 motion-safe:transition-transform motion-safe:duration-260 motion-safe:ease-chrome"
        />
      </summary>
      <div className="pt-2">{children}</div>
    </details>
  );
};
