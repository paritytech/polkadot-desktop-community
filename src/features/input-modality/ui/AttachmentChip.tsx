import EighthNotesIcon from '@/shared/assets/images/icons/eighth-notes.svg?jsx';
import FileTextIcon from '@/shared/assets/images/icons/file-text.svg?jsx';
import ImageIcon from '@/shared/assets/images/icons/image.svg?jsx';
import VideoIcon from '@/shared/assets/images/icons/video.svg?jsx';
import XIcon from '@/shared/assets/images/icons/x.svg?jsx';
import { IconButton } from '@/shared/components';
import { TEST_IDS } from '@/shared/test-ids';
import { formatBytes } from '@/shared/utils';
import { type AttachmentCategory } from '@/domains/input-routing';
import { inputModalityService } from '../service';
import { type DraftAttachment } from '../types';

// Fallback when there is no preview to show (audio and generic files always;
// image/video only when the loader produced no preview URL).
const categoryIcon: Record<AttachmentCategory, typeof FileTextIcon> = {
  image: ImageIcon,
  audio: EighthNotesIcon,
  video: VideoIcon,
  file: FileTextIcon,
};

type Props = {
  attachment: DraftAttachment;
  onRemove?: (id: string) => void;
  removeLabel: string;
};

export const AttachmentChip = ({ attachment, onRemove, removeLabel }: Props) => {
  const { fileName, mimeType } = attachment.routed.data;
  const Icon = categoryIcon[attachment.routed.category];
  const showPreview = inputModalityService.hasPreview(attachment);

  return (
    <div
      data-testid={TEST_IDS.inputModalityAttachment}
      data-kind={attachment.routed.category}
      title={mimeType}
      className="flex max-w-full items-center gap-2 rounded-2xl bg-bg-surface-nested py-1 pr-1 pl-2"
    >
      {showPreview ? (
        <img src={attachment.previewUrl} alt="" className="size-6 shrink-0 rounded object-cover" />
      ) : (
        <Icon className="size-4 shrink-0 text-fg-secondary" aria-hidden />
      )}
      <span className="min-w-0 flex-1 truncate text-xs text-fg-primary">{fileName}</span>
      <span className="shrink-0 text-xs text-fg-secondary">{formatBytes(attachment.sizeBytes)}</span>
      {onRemove && (
        <IconButton size="sm" label={removeLabel} onClick={() => onRemove(attachment.id)}>
          <XIcon />
        </IconButton>
      )}
    </div>
  );
};
