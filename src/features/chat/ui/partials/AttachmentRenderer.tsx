import { FileText, Image as ImageIcon, Loader2, Play } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { type FileAttachment, downloadChatFile } from '@/domains/chat';

type Props = {
  attachments: FileAttachment[];
  isMe: boolean;
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const toHexKey = (bytes: Uint8Array): string => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');

const useFileUrl = (attachment: FileAttachment) => {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const identifierKey = useMemo(() => toHexKey(attachment.identifier), [attachment.identifier]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);

    downloadChatFile(attachment)
      .then(blobUrl => {
        if (!cancelled) {
          setUrl(blobUrl);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [identifierKey]);

  return { url, loading, error };
};

const ImageAttachment = ({ attachment, isMe }: { attachment: FileAttachment; isMe: boolean }) => {
  const meta = attachment.meta;
  if (meta.type !== 'image') return null;

  const { url, loading, error } = useFileUrl(attachment);

  const hasDimensions = meta.width > 0 && meta.height > 0;
  const maxWidth = 240;
  const width = hasDimensions ? Math.min(meta.width, maxWidth) : maxWidth;
  const height = hasDimensions ? width / (meta.width / meta.height) : 160;

  return (
    <div
      className={`overflow-hidden rounded-xl ${isMe ? 'bg-bg-surface-nested-inverted' : 'bg-bg-surface-container'}`}
      style={{ width, height, maxWidth }}
    >
      {url && !error ? (
        <img src={url} alt="" className="size-full object-cover" />
      ) : (
        <div className="flex size-full items-center justify-center">
          {loading ? (
            <Loader2 className="size-6 animate-spin text-fg-tertiary" />
          ) : (
            <ImageIcon className="size-8 text-fg-tertiary" />
          )}
        </div>
      )}
    </div>
  );
};

const VideoAttachment = ({ attachment, isMe }: { attachment: FileAttachment; isMe: boolean }) => {
  const meta = attachment.meta;
  if (meta.type !== 'video') return null;

  const { url, loading, error } = useFileUrl(attachment);
  const [playing, setPlaying] = useState(false);

  // The play overlay is shown until the user clicks it — at that point we
  // mount the <video> with native controls + autoplay so playback starts
  // immediately. Before click we show a one-frame preview (preload=metadata)
  // when the URL is ready, or the spinner / placeholder otherwise.
  return (
    <div
      className={`relative flex h-32 w-48 items-center justify-center overflow-hidden rounded-xl ${isMe ? 'bg-bg-surface-nested-inverted' : 'bg-bg-surface-container'}`}
    >
      {url && !error ? (
        playing ? (
          <video src={url} className="size-full object-contain" controls autoPlay playsInline />
        ) : (
          <video src={url} className="size-full object-cover" preload="metadata" muted playsInline />
        )
      ) : loading ? (
        <Loader2 className="size-6 animate-spin text-fg-tertiary" />
      ) : null}
      {!playing && (
        <button
          type="button"
          aria-label="Play video"
          disabled={!url || !!error}
          className="absolute flex size-10 items-center justify-center rounded-full bg-black/50 enabled:cursor-pointer disabled:cursor-default"
          onClick={() => {
            if (url && !error) setPlaying(true);
          }}
        >
          <Play className="size-5 text-white" fill="white" />
        </button>
      )}
      {!playing && (
        <span className="pointer-events-none absolute right-2 bottom-2 rounded bg-black/60 px-1.5 py-0.5 text-xs text-white">
          {formatDuration(meta.duration)}
        </span>
      )}
    </div>
  );
};

const GeneralAttachment = ({ attachment, isMe }: { attachment: FileAttachment; isMe: boolean }) => {
  const { url } = useFileUrl(attachment);

  return (
    <a
      href={url ?? undefined}
      download={`file.${attachment.meta.mimeType.split('/')[1] ?? 'bin'}`}
      className={`flex items-center gap-2 rounded-xl px-3 py-2 ${isMe ? 'bg-bg-surface-nested-inverted' : 'bg-bg-surface-container'} ${url ? 'cursor-pointer hover:opacity-80' : 'pointer-events-none'}`}
    >
      <FileText className={`size-8 shrink-0 ${isMe ? 'text-fg-tertiary-inverted' : 'text-fg-tertiary'}`} />
      <div className="flex min-w-0 flex-col">
        <span className={`truncate text-sm ${isMe ? 'text-fg-primary-inverted' : 'text-fg-primary'}`}>
          {attachment.meta.mimeType}
        </span>
        <span className={`text-xs ${isMe ? 'text-fg-tertiary-inverted' : 'text-fg-tertiary'}`}>
          {formatFileSize(attachment.meta.fileSize)}
        </span>
      </div>
    </a>
  );
};

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export const AttachmentRenderer = ({ attachments, isMe }: Props) => {
  return (
    <div className="flex flex-col gap-1">
      {attachments.map((attachment, index) => {
        switch (attachment.meta.type) {
          case 'image':
            return <ImageAttachment key={index} attachment={attachment} isMe={isMe} />;
          case 'video':
            return <VideoAttachment key={index} attachment={attachment} isMe={isMe} />;
          default:
            return <GeneralAttachment key={index} attachment={attachment} isMe={isMe} />;
        }
      })}
    </div>
  );
};
