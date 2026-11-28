import { useCallback, useState } from 'react';
import { createPortal } from 'react-dom';

import { DropdownMenu } from '@/shared/components';
import { ChevronRightIcon, CircleCheckIcon, CopyIcon, ForwardIcon, ReplyIcon, SquarePenIcon, TrashIcon } from '@/shared/icons';
import { TEST_IDS } from '@/shared/test-ids';
import { useTranslation } from '@/shared/translation';
import { type ChatMessage } from '@/domains/chat';

import { EmojiPicker } from './EmojiPicker';
import { QuickReactionRow } from './QuickReactionRow';

type MessageContextMenuProps = {
  message: ChatMessage;
  position: { x: number; y: number };
  isEdited?: boolean;
  onClose: () => void;
  onReply?: (message: ChatMessage) => void;
  onEdit?: (message: ChatMessage) => void;
  onCopyText: (message: ChatMessage) => void;
  onViewEditHistory?: (message: ChatMessage) => void;
  onToggleReaction?: (messageId: string, emoji: string) => void;
};

export const MessageContextMenu = ({
  message,
  position,
  isEdited,
  onClose,
  onReply,
  onEdit,
  onCopyText,
  onViewEditHistory,
  onToggleReaction,
}: MessageContextMenuProps) => {
  const { t } = useTranslation();
  const [showFullPicker, setShowFullPicker] = useState(false);

  const handleSelectEmoji = useCallback(
    (emoji: string) => {
      onToggleReaction?.(message.messageId, emoji);
      onClose();
    },
    [message.messageId, onToggleReaction, onClose],
  );

  const isOutgoing = message.status.direction === 'outgoing';
  const isEditable =
    isOutgoing && (message.content.type === 'text' || message.content.type === 'richText' || message.content.type === 'reply');

  return (
    <DropdownMenu.Root
      open
      modal={false}
      onOpenChange={open => {
        if (!open) onClose();
      }}
    >
      {/* Portaled so the fixed anchor resolves against the window, not a transformed host such as QuickChat's popover. */}
      {createPortal(
        <DropdownMenu.Trigger asChild>
          <span aria-hidden className="pointer-events-none fixed size-0" style={{ left: position.x, top: position.y }} />
        </DropdownMenu.Trigger>,
        document.body,
      )}
      <DropdownMenu.Content
        align="start"
        sideOffset={4}
        aria-label={t('feature.chat.messageActions')}
        data-testid={TEST_IDS.chatMessageContextMenu}
        onCloseAutoFocus={event => event.preventDefault()}
        // Reply and Edit focus the composer from the item's select, which closes the menu itself; dismissing on that
        // focus as well would report `onClose` twice.
        onFocusOutside={event => event.preventDefault()}
      >
        {showFullPicker ? (
          <EmojiPicker onSelect={handleSelectEmoji} onClose={onClose} />
        ) : (
          <>
            <QuickReactionRow onSelectEmoji={handleSelectEmoji} onOpenFullPicker={() => setShowFullPicker(true)} />
            <DropdownMenu.Separator />
            {onReply ? (
              <DropdownMenu.Item data-testid={TEST_IDS.chatMessageContextMenuReply} onSelect={() => onReply(message)}>
                <ReplyIcon />
                {t('common.action.reply')}
              </DropdownMenu.Item>
            ) : null}
            <DropdownMenu.Item data-testid={TEST_IDS.chatMessageContextMenuCopy} onSelect={() => onCopyText(message)}>
              <CopyIcon />
              {t('common.action.copyText')}
            </DropdownMenu.Item>
            <DropdownMenu.Separator />
            {isEditable && onEdit ? (
              <DropdownMenu.Item data-testid={TEST_IDS.chatMessageContextMenuEdit} onSelect={() => onEdit(message)}>
                <SquarePenIcon />
                {t('feature.chat.editMessage')}
              </DropdownMenu.Item>
            ) : null}
            {isEdited ? (
              <DropdownMenu.Item
                data-testid={TEST_IDS.chatMessageContextMenuEditHistory}
                onSelect={() => onViewEditHistory?.(message)}
              >
                <SquarePenIcon />
                {t('feature.chat.viewEditHistory')}
              </DropdownMenu.Item>
            ) : null}
            {/* TODO(chat): enable Forward, Select and Delete when message forwarding, selection and deletion exist; shown disabled to match the design until then. */}
            <DropdownMenu.Item data-testid={TEST_IDS.chatMessageContextMenuForward} disabled>
              <ForwardIcon />
              {t('common.action.forward')}
              <ChevronRightIcon className="ms-auto rtl:-scale-x-100" />
            </DropdownMenu.Item>
            <DropdownMenu.Item data-testid={TEST_IDS.chatMessageContextMenuSelect} disabled>
              <CircleCheckIcon />
              {t('common.action.select')}
            </DropdownMenu.Item>
            <DropdownMenu.Separator />
            <DropdownMenu.Item data-testid={TEST_IDS.chatMessageContextMenuDelete} variant="danger" disabled>
              <TrashIcon />
              {t('common.action.delete')}
            </DropdownMenu.Item>
          </>
        )}
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
};
