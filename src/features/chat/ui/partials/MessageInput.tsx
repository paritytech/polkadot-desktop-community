import { ArrowUp } from 'lucide-react';
import { type ChangeEvent, type KeyboardEvent, type Ref, useCallback, useEffect, useRef, useState, useTransition } from 'react';

import { TEST_IDS } from '@/shared/test-ids';
import { useTranslation } from '@/shared/translation';

import { type SelectedAttachment, AttachmentPreview } from './AttachmentPreview';

const LINE_HEIGHT = 24; // px, matches text-base line-height
const MAX_LINES = 5;
// Uncomment when hop submit for media sending is ready
// import { Plus } from 'lucide-react';
// const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB
// const ACCEPTED_TYPES = 'image/*,video/*,.pdf,.doc,.docx,.txt,.zip';
//
// const getImageDimensions = (file: File): Promise<{ width: number; height: number }> =>
//   new Promise(resolve => {
//     const url = URL.createObjectURL(file);
//     const img = new window.Image();
//     img.onload = () => {
//       URL.revokeObjectURL(url);
//       resolve({ width: img.naturalWidth, height: img.naturalHeight });
//     };
//     img.onerror = () => {
//       URL.revokeObjectURL(url);
//       resolve({ width: 0, height: 0 });
//     };
//     img.src = url;
//   });

type Props = {
  ref?: Ref<HTMLTextAreaElement>;
  initialText?: string;
  submitAction(message: string, attachments?: SelectedAttachment[]): Promise<void>;
};

const MAX_HEIGHT = LINE_HEIGHT * MAX_LINES;

export const MessageInput = ({ ref, initialText, submitAction }: Props) => {
  const { t } = useTranslation();
  const [pending, startTransition] = useTransition();
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState<SelectedAttachment[]>([]);
  // Uncomment when hop submit for media sending is ready
  // const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const setRef = useCallback(
    (el: HTMLTextAreaElement | null) => {
      textareaRef.current = el;
      if (typeof ref === 'function') ref(el);
      else if (ref) ref.current = el;
    },
    [ref],
  );

  // Resize the textarea to fit content; only allow scrolling once we've hit
  // the max height. Default `overflow: hidden` prevents a phantom scrollbar
  // when the content fits but the browser reserves track space for `auto`.
  const autoSizeTo = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto';
    const next = Math.min(el.scrollHeight, MAX_HEIGHT);
    el.style.height = `${next}px`;
    el.style.overflowY = el.scrollHeight > MAX_HEIGHT ? 'auto' : 'hidden';
  };

  useEffect(() => {
    setText(initialText ?? '');
    if (textareaRef.current) autoSizeTo(textareaRef.current);
  }, [initialText]);

  const canSend = (text.trim().length > 0 || attachments.length > 0) && !pending;

  const send = () => {
    if (!canSend) return;
    startTransition(async () => {
      try {
        await submitAction(text, attachments.length > 0 ? attachments : undefined);
      } catch {
        // Keep the draft: clearing on a failed send would lose the user's
        // text on top of the failure (e.g. a paste rejected as too large for
        // a statement). Surfacing the error is the submitAction owner's job.
        return;
      }
      setText('');
      setAttachments([]);
      if (textareaRef.current) autoSizeTo(textareaRef.current);
    });
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    autoSizeTo(e.target);
    setText(e.target.value);
  };

  // Uncomment when hop submit for media sending is ready
  // const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
  //   const files = e.target.files;
  //   if (!files) return;
  //
  //   const newAttachments: SelectedAttachment[] = [];
  //   for (let i = 0; i < files.length; i++) {
  //     const file = files[i];
  //     if (!file) continue;
  //     if (file.size > MAX_FILE_SIZE) continue;
  //
  //     const isImage = file.type.startsWith('image/');
  //     const dims = isImage ? await getImageDimensions(file) : undefined;
  //
  //     newAttachments.push({
  //       id: crypto.randomUUID(),
  //       file,
  //       previewUrl: isImage ? URL.createObjectURL(file) : undefined,
  //       width: dims?.width,
  //       height: dims?.height,
  //     });
  //   }
  //
  //   setAttachments(prev => [...prev, ...newAttachments]);
  //
  //   // Reset input so same file can be selected again
  //   if (fileInputRef.current) {
  //     fileInputRef.current.value = '';
  //   }
  // };

  const removeAttachment = (id: string) => {
    setAttachments(prev => {
      const removed = prev.find(a => a.id === id);
      if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
      return prev.filter(a => a.id !== id);
    });
  };

  return (
    <div className="flex flex-col gap-2">
      {attachments.length > 0 && <AttachmentPreview attachments={attachments} onRemove={removeAttachment} />}
      <div className="flex items-end gap-2">
        {/* Uncomment when hop submit for media sending is ready */}
        {/*
        <button
          className="flex size-12 shrink-0 items-center justify-center rounded-full bg-bg-action-secondary transition-colors hover:bg-bg-action-secondary-hover"
          onClick={() => fileInputRef.current?.click()}
        >
          <Plus className="size-6 text-fg-primary" />
        </button>
        <input ref={fileInputRef} type="file" multiple accept={ACCEPTED_TYPES} className="hidden" onChange={handleFileSelect} />
        */}
        <div className="flex min-h-12 min-w-0 flex-1 items-center gap-2 rounded-3xl bg-bg-action-secondary py-2 pr-2 pl-4">
          <textarea
            ref={setRef}
            data-testid={TEST_IDS.chatMessageInput}
            data-no-app-focus
            rows={1}
            value={text}
            className="block min-w-0 flex-1 resize-none overflow-y-hidden bg-transparent text-base leading-5 text-fg-primary outline-none placeholder:text-fg-tertiary"
            style={{ maxHeight: MAX_HEIGHT }}
            placeholder={t('common.action.writeMessage')}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
          />
          {canSend && (
            <button
              data-testid={TEST_IDS.chatSendButton}
              // eslint-disable-next-line formatjs/no-literal-string-in-jsx -- aria-label retained for e2e selector
              aria-label="Send"
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-bg-action-primary transition-colors hover:bg-bg-action-primary-hover"
              onClick={() => send()}
            >
              <ArrowUp className="size-5 text-fg-primary-inverted" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
