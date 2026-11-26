import { type LucideIcon, CheckCircle2, ChevronRight, Copy, Forward, Reply, SquarePen, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { TEST_IDS } from '@/shared/test-ids';
import { useTranslation } from '@/shared/translation';
import { cnTw } from '@/shared/utils';
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

type MenuItemProps = {
  testId?: string;
  icon: LucideIcon;
  label: string;
  variant?: 'default' | 'danger';
  disabled?: boolean;
  hasSubmenu?: boolean;
  onClick?: VoidFunction;
};

const MenuItem = ({ testId, icon: Icon, label, variant = 'default', disabled, hasSubmenu, onClick }: MenuItemProps) => {
  const isDanger = variant === 'danger';
  return (
    <button
      data-testid={testId}
      disabled={disabled}
      className={cnTw(
        'flex h-control w-full items-center gap-2 rounded px-2 transition-colors',
        disabled ? 'cursor-not-allowed opacity-40' : 'hover:bg-bg-selection-container-hover',
        isDanger ? 'text-fg-error' : 'text-fg-primary',
      )}
      onClick={onClick}
    >
      <Icon className="size-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate text-start text-sm font-normal">{label}</span>
      {hasSubmenu ? <ChevronRight className="size-4 shrink-0 text-fg-secondary" /> : null}
    </button>
  );
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
  const containerRef = useRef<HTMLDivElement>(null);
  const [showFullPicker, setShowFullPicker] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const target = event.target as Node;
      if (containerRef.current && !containerRef.current.contains(target)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  useEffect(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      if (rect.right > viewportWidth) {
        containerRef.current.style.left = `${position.x - rect.width}px`;
      }
      if (rect.bottom > viewportHeight) {
        containerRef.current.style.top = `${position.y - rect.height}px`;
      }
    }
  }, [position, showFullPicker]);

  const handleSelectEmoji = useCallback(
    (emoji: string) => {
      onToggleReaction?.(message.messageId, emoji);
      onClose();
    },
    [message.messageId, onToggleReaction, onClose],
  );

  const handleReply = () => {
    onReply?.(message);
    onClose();
  };

  const handleEdit = () => {
    onEdit?.(message);
    onClose();
  };

  const handleCopyText = () => {
    onCopyText(message);
    onClose();
  };

  const handleViewEditHistory = () => {
    onViewEditHistory?.(message);
    onClose();
  };

  const isOutgoing = message.status.direction === 'outgoing';
  const isEditable =
    isOutgoing && (message.content.type === 'text' || message.content.type === 'richText' || message.content.type === 'reply');

  return createPortal(
    // no-drag: this layer portals to <body> and can flip upward over the toolbar's
    // drag region (see src/index.css) — without it, presses there go to the OS.
    <div
      ref={containerRef}
      className="pointer-events-none fixed z-50 flex flex-col items-start gap-1.5"
      style={{ left: position.x, top: position.y, appRegion: 'no-drag' }}
    >
      {showFullPicker ? (
        <div className="pointer-events-auto">
          <EmojiPicker onSelect={handleSelectEmoji} onClose={onClose} />
        </div>
      ) : (
        <>
          {/* Floating reaction bar */}
          <div className="pointer-events-auto">
            <QuickReactionRow onSelectEmoji={handleSelectEmoji} onOpenFullPicker={() => setShowFullPicker(true)} />
          </div>

          {/* Context menu */}
          <div
            data-testid={TEST_IDS.chatMessageContextMenu}
            className="pointer-events-auto flex w-52 flex-col gap-1 rounded-lg border border-stroke-primary bg-bg-surface-container p-1 shadow-[0px_4px_6px_-1px_var(--shadow-soft),0px_2px_4px_-2px_var(--shadow-soft)]"
          >
            <div className="flex w-full flex-col">
              {onReply ? (
                <MenuItem
                  testId={TEST_IDS.chatMessageContextMenuReply}
                  icon={Reply}
                  label={t('common.action.reply')}
                  onClick={handleReply}
                />
              ) : null}
              <MenuItem
                testId={TEST_IDS.chatMessageContextMenuCopy}
                icon={Copy}
                label={t('common.action.copyText')}
                onClick={handleCopyText}
              />
            </div>

            <div className="h-px w-full bg-stroke-secondary" />

            <div className="flex w-full flex-col">
              {isEditable && onEdit ? (
                <MenuItem
                  testId={TEST_IDS.chatMessageContextMenuEdit}
                  icon={SquarePen}
                  label={t('feature.chat.editMessage')}
                  onClick={handleEdit}
                />
              ) : null}
              {isEdited ? (
                <MenuItem
                  testId={TEST_IDS.chatMessageContextMenuEditHistory}
                  icon={SquarePen}
                  label={t('feature.chat.viewEditHistory')}
                  onClick={handleViewEditHistory}
                />
              ) : null}
              {/* Forward / Select are not wired up yet — shown disabled to match the design. */}
              <MenuItem
                testId={TEST_IDS.chatMessageContextMenuForward}
                icon={Forward}
                label={t('common.action.forward')}
                hasSubmenu
                disabled
              />
              <MenuItem
                testId={TEST_IDS.chatMessageContextMenuSelect}
                icon={CheckCircle2}
                label={t('common.action.select')}
                disabled
              />
            </div>

            <div className="h-px w-full bg-stroke-secondary" />

            <div className="flex w-full flex-col">
              {/* Delete is not wired up yet — shown disabled to match the design. */}
              <MenuItem
                testId={TEST_IDS.chatMessageContextMenuDelete}
                icon={Trash2}
                label={t('common.action.delete')}
                variant="danger"
                disabled
              />
            </div>
          </div>
        </>
      )}
    </div>,
    document.body,
  );
};
