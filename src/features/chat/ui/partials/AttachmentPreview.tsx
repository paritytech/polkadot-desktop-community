import { FileText, X } from 'lucide-react';

import { IconButton } from '@/shared/components';
import { useTranslation } from '@/shared/translation';

export type SelectedAttachment = {
  id: string;
  file: File;
  previewUrl?: string;
  width?: number;
  height?: number;
};

type Props = {
  attachments: SelectedAttachment[];
  onRemove: (id: string) => void;
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const AttachmentPreview = ({ attachments, onRemove }: Props) => {
  const { t } = useTranslation();

  return (
    <div className="flex gap-2 overflow-x-auto px-1 py-1">
      {attachments.map(attachment => (
        <div key={attachment.id} className="group relative shrink-0">
          {attachment.previewUrl ? (
            <img src={attachment.previewUrl} alt={attachment.file.name} className="size-16 rounded-lg object-cover" />
          ) : (
            <div className="flex size-16 flex-col items-center justify-center gap-1 rounded-xl bg-bg-surface-nested">
              <FileText className="size-5 text-fg-tertiary" />
              <span className="max-w-14 truncate text-2xs font-medium text-fg-tertiary">
                {formatFileSize(attachment.file.size)}
              </span>
            </div>
          )}
          <span className="absolute -end-1 -top-1 flex opacity-0 group-hover:opacity-100">
            <IconButton size="sm" label={t('feature.inputModality.removeAttachment')} onClick={() => onRemove(attachment.id)}>
              <X />
            </IconButton>
          </span>
        </div>
      ))}
    </div>
  );
};
