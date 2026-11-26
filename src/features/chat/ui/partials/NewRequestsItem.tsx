import { MessagesSquare } from 'lucide-react';

import { TEST_IDS } from '@/shared/test-ids';
import { useTranslation } from '@/shared/translation';

type NewRequestsItemProps = {
  count: number;
  subtitle: string;
  onClick: VoidFunction;
};

export const NewRequestsItem = ({ count, subtitle, onClick }: NewRequestsItemProps) => {
  const { t } = useTranslation();

  return (
    <div
      data-testid={TEST_IDS.chatNewRequestsItem}
      className="relative flex h-22 w-full cursor-pointer items-center gap-3 p-3 transition-colors after:absolute after:start-22 after:end-3 after:bottom-0 after:h-px after:bg-stroke-secondary hover:bg-bg-selection-container-hover"
      onClick={onClick}
    >
      <div className="flex size-16 shrink-0 items-center justify-center rounded-full bg-bg-surface-nested">
        <MessagesSquare className="size-7 text-fg-secondary" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
        <span className="min-w-0 truncate text-base font-semibold text-fg-primary">{t('feature.chat.request.entryTitle')}</span>
        {subtitle.length > 0 && <span className="min-w-0 truncate text-sm text-fg-secondary">{subtitle}</span>}
      </div>
      <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-bg-illustration-dark px-1">
        <span className="text-center text-xs font-semibold tracking-[1px] text-fg-primary-inverted">{count}</span>
      </span>
    </div>
  );
};
