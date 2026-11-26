import { ArrowUp, Loader2, X } from 'lucide-react';
import {
  type ChangeEvent,
  type KeyboardEvent,
  type Ref,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useTransition,
} from 'react';

import { IconButton } from '@/shared/components';
import { TEST_IDS } from '@/shared/test-ids';
import { useTranslation } from '@/shared/translation';
import { cnTw } from '@/shared/utils';

import { type SelectedAttachment, AttachmentPreview } from './AttachmentPreview';

const LINE_HEIGHT = 20; // px, matches text-base line-height
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

// Reply/edit context card above the textarea (Figma "_Edit or Reply Message").
type ComposerPreview = {
  testId?: string;
  title: string;
  text: string;
  onClose: () => void;
};

type Props = {
  ref?: Ref<HTMLTextAreaElement>;
  initialText?: string;
  preview?: ComposerPreview;
  // Blocks typing and sending while an outgoing chat request is still pending acceptance.
  disabled?: boolean;
  /**
   * Keep the send button on screen while the send is in flight, disabled and spinning,
   * instead of unmounting it.
   *
   * The invitation composer opts in because its `submitAction` can stay pending
   * indefinitely (issue #873): unmounting the button there leaves the user with no
   * control, no spinner and no error — nothing at all to say a send is happening.
   */
  showSendProgress?: boolean;
  submitAction(message: string, attachments?: SelectedAttachment[]): Promise<void>;
};

const MAX_HEIGHT = LINE_HEIGHT * MAX_LINES;

export const MessageInput = ({ ref, initialText, preview, disabled = false, showSendProgress = false, submitAction }: Props) => {
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
  }, [initialText]);

  // Re-size on `text` (not just typing) to track programmatic changes (send clears, edit seeds);
  // layout effect reads `scrollHeight` post-commit but pre-paint, so the height never flickers.
  useLayoutEffect(() => {
    if (textareaRef.current) autoSizeTo(textareaRef.current);
  }, [text]);

  const canSend = !disabled && (text.trim().length > 0 || attachments.length > 0) && !pending;
  // `canSend` goes false the moment the send starts, which is what used to take the button
  // off screen with it. Opted-in composers keep it mounted for the duration instead.
  const showSendButton = canSend || (showSendProgress && pending);

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
    });
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
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
        <div
          className={cnTw(
            'flex min-w-0 flex-1 flex-col bg-bg-action-secondary',
            // Top corners tighten while a reply/edit card is stacked above the textarea.
            preview ? 'rounded-t-2xl rounded-b-3xl' : 'rounded-3xl',
            disabled && 'opacity-60',
          )}
        >
          {preview && (
            <div data-testid={preview.testId} className="px-1 pt-1">
              <div className="flex items-start overflow-hidden rounded-xl bg-bg-surface-container">
                <div className="flex min-w-0 flex-1 flex-col justify-center border-s-4 border-stroke-tertiary px-3 py-2">
                  <p className="truncate text-xs font-semibold text-fg-primary">{preview.title}</p>
                  <p className="line-clamp-3 text-xs font-medium text-fg-primary">{preview.text}</p>
                </div>
                <div className="flex items-center pe-0.5 pt-0.5">
                  <IconButton size="sm" label={t('common.aria.close')} onClick={preview.onClose}>
                    <X />
                  </IconButton>
                </div>
              </div>
            </div>
          )}
          <div className="flex min-h-12 items-center gap-2 py-2 ps-4 pe-2">
            <textarea
              ref={setRef}
              data-testid={TEST_IDS.chatMessageInput}
              data-no-app-focus
              rows={1}
              value={text}
              disabled={disabled}
              className={cnTw(
                'block min-w-0 flex-1 resize-none overflow-y-hidden bg-transparent text-base text-fg-primary outline-none placeholder:text-fg-tertiary',
                disabled && 'cursor-not-allowed',
              )}
              style={{ maxHeight: MAX_HEIGHT }}
              placeholder={t('common.action.writeMessage')}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
            />
            {showSendButton ? (
              <button
                data-testid={TEST_IDS.chatSendButton}
                // eslint-disable-next-line formatjs/no-literal-string-in-jsx -- aria-label retained for e2e selector
                aria-label="Send"
                disabled={!canSend}
                aria-busy={pending}
                className="flex size-control shrink-0 items-center justify-center rounded-full bg-bg-action-primary transition-colors hover:bg-bg-action-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => send()}
              >
                {pending ? (
                  <Loader2 className="size-5 animate-spin text-fg-primary-inverted" />
                ) : (
                  <ArrowUp className="size-5 text-fg-primary-inverted" />
                )}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};
