import { Dialog } from '@novasamatech/tr-ui';
import { useMemo } from 'react';

import { useTranslation } from '@/shared/translation';
import { type DiffPart, type EditHistoryEntry, computeTextDiff, formatMessageDate } from '../helpers/message';

type EditHistoryProps = {
  isOpen: boolean;
  originalText: string;
  originalTimestamp: number;
  entries: EditHistoryEntry[];
  onClose: VoidFunction;
};

export const EditHistory = ({ isOpen, originalText, originalTimestamp, entries, onClose }: EditHistoryProps) => {
  const { t } = useTranslation();

  const currentText = entries[0]?.text ?? originalText;
  const currentTimestamp = entries[0]?.timestamp ?? originalTimestamp;

  const historyDiffs = useMemo(() => {
    const versions = [...entries.map(e => e.text), originalText];
    const timestamps = [...entries.map(e => e.timestamp), originalTimestamp];

    const diffs: { parts: DiffPart[]; timestamp: number }[] = [];
    for (let i = 0; i < versions.length - 1; i++) {
      const prev = versions[i + 1];
      const curr = versions[i];
      const ts = timestamps[i];
      if (prev === undefined || curr === undefined || ts === undefined) continue;
      diffs.push({
        parts: computeTextDiff(prev, curr),
        timestamp: ts,
      });
    }

    return diffs;
  }, [entries, originalText, originalTimestamp]);

  return (
    <Dialog modal open={isOpen} onOpenChange={open => !open && onClose()}>
      <Dialog.Content>
        <div className="flex max-h-[480px] flex-col">
          {/* Current message */}
          <div className="flex flex-col gap-1.5 px-6 pt-6 pb-4">
            <span className="text-[11px] font-semibold tracking-widest text-fg-tertiary uppercase">
              {t('feature.chat.currentMessage')}
            </span>
            <p className="text-[15px] leading-5.5 whitespace-pre-line text-fg-primary">{currentText}</p>
            <span className="text-xs leading-4 text-fg-tertiary">{formatMessageDate(currentTimestamp)}</span>
          </div>

          <div className="mx-6 h-px bg-border-divider" />

          {/* Edit History section */}
          <div className="flex flex-col gap-3 overflow-y-auto px-6 pt-4 pb-6">
            <span className="text-[11px] font-semibold tracking-widest text-fg-tertiary uppercase">
              {t('feature.chat.editHistory')}
            </span>

            <div className="flex flex-col divide-y divide-border-divider rounded-2xl bg-bg-surface-nested">
              {historyDiffs.map((diff, idx) => (
                <div key={idx} className="flex flex-col gap-1.5 px-4 py-3">
                  <p className="text-[15px] leading-5.5 whitespace-pre-line text-fg-primary">
                    {diff.parts.map((part, partIdx) => (
                      <DiffSpan key={partIdx} part={part} />
                    ))}
                  </p>
                  <span className="text-xs leading-4 text-fg-tertiary">{formatMessageDate(diff.timestamp)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Dialog.Content>
    </Dialog>
  );
};

const DiffSpan = ({ part }: { part: DiffPart }) => {
  switch (part.type) {
    case 'unchanged':
      return <span>{part.text}</span>;
    case 'added':
      return <span className="rounded bg-bg-action-secondary px-1 py-0.5">{part.text}</span>;
    case 'deleted':
      return <span className="px-0.5 text-fg-tertiary line-through">{part.text}</span>;
  }
};
