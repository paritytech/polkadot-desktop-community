import { type ChangeEvent, type KeyboardEvent, type Ref, useEffect, useState, useTransition } from 'react';

import { IconButton, TextArea } from '@/shared/components';
import { ArrowUpIcon, LoaderCircleIcon } from '@/shared/icons';
import { TEST_IDS } from '@/shared/test-ids';
import { useTranslation } from '@/shared/translation';

import { type SelectedAttachment, AttachmentPreview } from './AttachmentPreview';
import { QuotedMessage } from './QuotedMessage';

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

export const MessageInput = ({ ref, initialText, preview, disabled = false, showSendProgress = false, submitAction }: Props) => {
  const { t } = useTranslation();
  const [pending, startTransition] = useTransition();
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState<SelectedAttachment[]>([]);

  useEffect(() => {
    setText(initialText ?? '');
  }, [initialText]);

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
      <TextArea
        ref={ref}
        data-testid={TEST_IDS.chatMessageInput}
        value={text}
        disabled={disabled}
        placeholder={t('common.action.writeMessage')}
        header={
          preview && (
            <div className="px-1 pt-1">
              <QuotedMessage testId={preview.testId} title={preview.title} text={preview.text} onDismiss={preview.onClose} />
            </div>
          )
        }
        trailing={
          showSendButton ? (
            <IconButton
              variant="primary"
              label={t('feature.chat.composer.send')}
              data-testid={TEST_IDS.chatSendButton}
              disabled={!canSend}
              aria-busy={pending}
              onClick={() => send()}
            >
              {pending ? <LoaderCircleIcon className="animate-spin" /> : <ArrowUpIcon />}
            </IconButton>
          ) : null
        }
        onChange={handleChange}
        onKeyDown={handleKeyDown}
      />
    </div>
  );
};
