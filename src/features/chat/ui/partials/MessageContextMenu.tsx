import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { useTranslation } from '@/shared/translation';
import { type ChatMessage } from '@/domains/chat';

import { EmojiPicker } from './EmojiPicker';
import { QuickReactionRow } from './QuickReactionRow';

type MessageContextMenuProps = {
  message: ChatMessage;
  position: { x: number; y: number };
  isEdited?: boolean;
  onClose: () => void;
  onReply: (message: ChatMessage) => void;
  onEdit: (message: ChatMessage) => void;
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
    onReply(message);
    onClose();
  };

  const handleEdit = () => {
    onEdit(message);
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
    <div
      ref={containerRef}
      className="fixed z-50 flex flex-col items-start gap-1.5"
      style={{ left: position.x, top: position.y }}
    >
      {showFullPicker ? (
        <EmojiPicker onSelect={handleSelectEmoji} onClose={onClose} />
      ) : (
        <>
          {/* Floating reaction bar */}
          <QuickReactionRow onSelectEmoji={handleSelectEmoji} onOpenFullPicker={() => setShowFullPicker(true)} />

          {/* Context menu */}
          <div className="flex w-52 flex-col items-start rounded-lg border border-[#e5e5e5] bg-white shadow-[0px_4px_6px_-1px_rgba(0,0,0,0.1),0px_2px_4px_-2px_rgba(0,0,0,0.1)]">
            <div className="flex w-full flex-col items-start px-1 pt-1">
              <button
                className="flex h-8 w-full items-center rounded p-2 transition-colors hover:bg-[#f5f5f5]"
                onClick={handleReply}
              >
                <div className="flex min-w-0 flex-1 items-center">
                  <span className="text-sm leading-5 font-normal text-[#0a0a0a]">{t('common.action.reply')}</span>
                </div>
                <div className="flex items-center justify-center">
                  {/* eslint-disable-next-line formatjs/no-literal-string-in-jsx */}
                  <span className="text-xs leading-4 text-[#737373]">⌘[</span>
                </div>
              </button>
              {isEditable && (
                <button
                  className="flex h-8 w-full items-center rounded p-2 transition-colors hover:bg-[#f5f5f5]"
                  onClick={handleEdit}
                >
                  <div className="flex min-w-0 flex-1 items-center">
                    <span className="text-sm leading-5 font-normal text-[#0a0a0a]">{t('feature.chat.editMessage')}</span>
                  </div>
                </button>
              )}
              {isEdited && (
                <button
                  className="flex h-8 w-full items-center rounded p-2 transition-colors hover:bg-[#f5f5f5]"
                  onClick={handleViewEditHistory}
                >
                  <div className="flex min-w-0 flex-1 items-center">
                    <span className="text-sm leading-5 font-normal text-[#0a0a0a]">{t('feature.chat.viewEditHistory')}</span>
                  </div>
                </button>
              )}
            </div>

            <div className="h-2 w-full border-b border-[#e5e5e5]" />

            <div className="flex w-full flex-col items-start px-1 py-1">
              <button
                className="flex h-8 w-full items-center rounded p-2 transition-colors hover:bg-[#f5f5f5]"
                onClick={handleCopyText}
              >
                <div className="flex min-w-0 flex-1 items-center">
                  <span className="text-sm leading-5 font-normal text-[#0a0a0a]">{t('common.action.copyText')}</span>
                </div>
                <div className="flex items-center justify-center">
                  {/* eslint-disable-next-line formatjs/no-literal-string-in-jsx */}
                  <span className="text-xs leading-4 text-[#737373]">⌘C</span>
                </div>
              </button>
            </div>
          </div>
        </>
      )}
    </div>,
    document.body,
  );
};
