import FileIcon from '@/shared/assets/images/icons/file.svg?jsx';
import ImageIcon from '@/shared/assets/images/icons/image.svg?jsx';
import PhoneIcon from '@/shared/assets/images/icons/phone.svg?jsx';
import VideoIcon from '@/shared/assets/images/icons/video.svg?jsx';
import { type MessagePreviewIcon } from '../helpers/message';

type Props = {
  kind: MessagePreviewIcon;
};

// `Phone` / `Video` deliberately match CallMessageBubble, so a call reads the
// same in the list as it does in the conversation.
export const PreviewIcon = ({ kind }: Props) => {
  if (!kind) return null;

  const Icon =
    kind === 'image'
      ? ImageIcon
      : kind === 'video' || kind === 'videoCall'
        ? VideoIcon
        : kind === 'voiceCall'
          ? PhoneIcon
          : FileIcon;

  return <Icon className="me-1 inline size-3 align-text-bottom" />;
};
