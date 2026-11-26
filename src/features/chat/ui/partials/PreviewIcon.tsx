import { File, Image as ImageIcon, Phone, Video } from 'lucide-react';

import { type MessagePreviewIcon } from '../helpers/message';

type Props = {
  kind: MessagePreviewIcon;
};

// `Phone` / `Video` deliberately match CallMessageBubble, so a call reads the
// same in the list as it does in the conversation.
export const PreviewIcon = ({ kind }: Props) => {
  if (!kind) return null;

  const Icon =
    kind === 'image' ? ImageIcon : kind === 'video' || kind === 'videoCall' ? Video : kind === 'voiceCall' ? Phone : File;

  return <Icon className="me-1 inline size-3 align-text-bottom" />;
};
