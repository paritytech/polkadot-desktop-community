import { Fragment } from 'react';

import { Dialog } from '@/shared/components';
import { useTranslation } from '@/shared/translation';
import { type EditHistoryEntry } from '../helpers/message';

type EditHistoryProps = {
  isOpen: boolean;
  originalText: string;
  entries: EditHistoryEntry[];
  onClose: VoidFunction;
};

export const EditHistory = ({ isOpen, originalText, entries, onClose }: EditHistoryProps) => {
  const { t } = useTranslation();

  // Newest → oldest: the latest edit is the current message, the original is the last entry.
  const versions = [...entries.map(e => e.text), originalText];
  const currentText = versions[0] ?? originalText;
  const earlierTexts = versions.slice(1);

  return (
    <Dialog.Root modal open={isOpen} onOpenChange={open => !open && onClose()}>
      <Dialog.Content aria-describedby={undefined}>
        <Dialog.Title>
          <span className="text-fg-primary">{t('feature.chat.editHistory')}</span>
        </Dialog.Title>

        <div className="flex max-h-[60dvh] flex-col gap-2 overflow-y-auto pe-2">
          <VersionLabel>{t('feature.chat.currentMessage')}</VersionLabel>
          <VersionBubble text={currentText} />

          {earlierTexts.map((text, idx) => (
            <Fragment key={idx}>
              <VersionLabel>{t('feature.chat.earlierVersion')}</VersionLabel>
              <VersionBubble text={text} />
            </Fragment>
          ))}
        </div>
      </Dialog.Content>
    </Dialog.Root>
  );
};

const VersionLabel = ({ children }: { children: string }) => (
  <span className="px-3 py-1 text-center text-sm font-medium text-fg-secondary">{children}</span>
);

const VersionBubble = ({ text }: { text: string }) => (
  <div className="w-fit max-w-full self-center rounded-2xl bg-bg-surface-container-inverted px-3 py-2.5 text-base whitespace-pre-line text-fg-primary-inverted">
    {text}
  </div>
);
