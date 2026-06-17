import { type FileAttachment } from '@/domains/chat';

import { MediaPlaceholder } from './MediaPlaceholder';

type Props = {
  attachments: FileAttachment[];
  isMe: boolean;
};

// Only image/video carry a blurhash thumbnail; general files have none.
const blurhashOf = (meta: FileAttachment['meta']): string | undefined =>
  meta.type === 'image' || meta.type === 'video' ? meta.blurhash : undefined;

// Desktop never downloads chat media (image/video/file): the HOP claim is
// one-shot, so claiming here would deny the mobile recipient. Every attachment
// renders a placeholder pointing the user to the mobile app instead — with the
// blurhash preview behind it when the thumbnail is present (also no HOP).
export const AttachmentRenderer = ({ attachments, isMe }: Props) => {
  return (
    <div className="flex flex-col gap-1">
      {attachments.map(attachment => (
        <MediaPlaceholder key={attachment.identifier.join('-')} isMe={isMe} blurhash={blurhashOf(attachment.meta)} />
      ))}
    </div>
  );
};
