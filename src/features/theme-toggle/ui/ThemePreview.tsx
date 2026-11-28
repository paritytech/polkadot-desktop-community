import { type PropsWithChildren } from 'react';

import { CheckIcon } from '@/shared/icons';
import { TEST_IDS } from '@/shared/test-ids';
import { useTranslation } from '@/shared/translation';

const OutgoingBubble = ({ time, children }: PropsWithChildren<{ time: string }>) => (
  <div className="flex justify-end">
    <div className="flex max-w-[80%] items-end gap-1.5 rounded-2xl bg-bg-action-primary px-3 py-2">
      <span className="text-sm text-fg-primary-inverted">{children}</span>
      <span className="flex shrink-0 items-center gap-0.5 pb-0.5 text-2xs font-medium text-fg-primary-inverted/60">
        {time}
        <CheckIcon className="size-3" />
      </span>
    </div>
  </div>
);

const IncomingBubble = ({ time, children }: PropsWithChildren<{ time: string }>) => (
  <div className="flex justify-start">
    <div className="flex max-w-[80%] items-end gap-1.5 rounded-2xl bg-bg-surface-container px-3 py-2">
      <span className="text-sm text-fg-primary">{children}</span>
      <span className="shrink-0 pb-0.5 text-2xs font-medium text-fg-tertiary">{time}</span>
    </div>
  </div>
);

export const ThemePreview = () => {
  const { t } = useTranslation();

  return (
    <div
      aria-hidden
      data-testid={TEST_IDS.themePreview}
      className="flex flex-col gap-3 overflow-hidden rounded-2xl bg-bg-surface-nested p-4 select-none"
    >
      <OutgoingBubble time="2:33">{t('feature.themeToggle.preview.outgoingFirst')}</OutgoingBubble>
      <IncomingBubble time="2:33">{t('feature.themeToggle.preview.incoming')}</IncomingBubble>
      <OutgoingBubble time="12:42">{t('feature.themeToggle.preview.outgoingSecond')}</OutgoingBubble>
    </div>
  );
};
