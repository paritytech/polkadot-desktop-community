import { CheckCircle2, ChevronRight, Copy, Forward, Reply, SquarePen, Trash2 } from 'lucide-react';
import { useCallback, useState } from 'react';

import { DropdownMenu } from '@/shared/components';
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
      onOpenChange={open => {
        if (!open) onClose();
      }}
    >
      <DropdownMenu.Trigger asChild>
        <span aria-hidden className="pointer-events-none fixed size-0" style={{ left: position.x, top: position.y }} />
      </DropdownMenu.Trigger>
      <DropdownMenu.Content
        align="start"
        sideOffset={4}
        data-testid={TEST_IDS.chatMessageContextMenu}
        onCloseAutoFocus={event => event.preventDefault()}
      >
        {showFullPicker ? (
          <EmojiPicker onSelect={handleSelectEmoji} onClose={onClose} />
        ) : (
          <>
            <QuickReactionRow onSelectEmoji={handleSelectEmoji} onOpenFullPicker={() => setShowFullPicker(true)} />
            <DropdownMenu.Separator />
            {onReply ? (
              <DropdownMenu.Item data-testid={TEST_IDS.chatMessageContextMenuReply} onSelect={() => onReply(message)}>
                <Reply />
                {t('common.action.reply')}
              </DropdownMenu.Item>
            ) : null}
            <DropdownMenu.Item data-testid={TEST_IDS.chatMessageContextMenuCopy} onSelect={() => onCopyText(message)}>
              <Copy />
              {t('common.action.copyText')}
            </DropdownMenu.Item>
            <DropdownMenu.Separator />
            {isEditable && onEdit ? (
              <DropdownMenu.Item data-testid={TEST_IDS.chatMessageContextMenuEdit} onSelect={() => onEdit(message)}>
                <SquarePen />
                {t('feature.chat.editMessage')}
              </DropdownMenu.Item>
            ) : null}
            {isEdited ? (
              <DropdownMenu.Item
                data-testid={TEST_IDS.chatMessageContextMenuEditHistory}
                onSelect={() => onViewEditHistory?.(message)}
              >
                <SquarePen />
                {t('feature.chat.viewEditHistory')}
              </DropdownMenu.Item>
            ) : null}
            {/* Forward, Select and Delete are not wired up yet — shown disabled to match the design. */}
            <DropdownMenu.Item data-testid={TEST_IDS.chatMessageContextMenuForward} disabled>
              <Forward />
              {t('common.action.forward')}
              <ChevronRight className="ms-auto" />
            </DropdownMenu.Item>
            <DropdownMenu.Item data-testid={TEST_IDS.chatMessageContextMenuSelect} disabled>
              <CheckCircle2 />
              {t('common.action.select')}
            </DropdownMenu.Item>
            <DropdownMenu.Separator />
            <DropdownMenu.Item data-testid={TEST_IDS.chatMessageContextMenuDelete} variant="danger" disabled>
              <Trash2 />
              {t('common.action.delete')}
            </DropdownMenu.Item>
          </>
        )}
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
};
