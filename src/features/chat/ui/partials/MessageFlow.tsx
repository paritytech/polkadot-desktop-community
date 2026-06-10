import { MessagesSquare } from 'lucide-react';
import { type MouseEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useObservable } from 'react-rx';

import { useTranslation } from '@/shared/translation';
import { cnTw } from '@/shared/utils';
import { type ChatMessage, type ChatSession, chatMessageService, useMessageReactions, useToggleReaction } from '@/domains/chat';
import { type CallState, deriveCallStates } from '../helpers/callState';
import { deriveLatestEdits, getEditHistory, getPlainText } from '../helpers/message';

import { CallMessageBubble } from './CallMessageBubble';
import { CoinageTransferMessageBubble } from './CoinageTransferMessageBubble';
import { EditHistory } from './EditHistory';
import { ChatEventItem, DateSeparator, MessageBubble } from './MessageBubble';
import { MessageContextMenu } from './MessageContextMenu';
import { NoData } from './NoData';
import { TransferMessageBubble } from './TransferMessageBubble';

type ChatConversationViewProps = {
  session: ChatSession;
  onReply(message: ChatMessage): void;
  onEdit(message: ChatMessage, displayText: string): void;
};

type ContextMenuState = {
  message: ChatMessage;
  position: { x: number; y: number };
};

export const MessageFlow = ({ session, onReply, onEdit }: ChatConversationViewProps) => {
  const { t } = useTranslation();
  const firstOpenRef = useRef(true);

  const messages = useObservable(session.messages, []);
  const messageReactions = useMessageReactions(messages);
  const onToggleReaction = useToggleReaction(session, messages);
  const messageMap = useMemo(() => new Map(messages.map(m => [m.messageId, m])), [messages]);

  const latestEdits = useMemo(() => deriveLatestEdits(messages), [messages]);
  const callStates = useMemo(() => deriveCallStates(messages), [messages]);

  const displayMessages = useMemo(
    () =>
      messages.filter(m => {
        // Sync-only carrier rows (deviceChatAccepted) have no user-facing content —
        // rendering one produces an empty bubble.
        if (chatMessageService.isSyncCarrier(m.content)) return false;
        // Hide signals folded into derived call state — only the offer row stays visible.
        if (m.content.type === 'callSignal' && m.content.signal !== 'offer') return false;
        return m.content.type !== 'reacted' && m.content.type !== 'reactionRemoved' && m.content.type !== 'edit';
      }),
    [messages],
  );
  const groupedMessages = useGroupedMessages(displayMessages);

  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [editHistoryTarget, setEditHistoryTarget] = useState<ChatMessage | null>(null);

  const editHistoryEntries = useMemo(() => {
    if (!editHistoryTarget) return [];
    return getEditHistory(messages, editHistoryTarget.messageId);
  }, [messages, editHistoryTarget]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const hasMessages = groupedMessages.length > 0;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: firstOpenRef.current ? 'instant' : 'smooth',
      block: 'center',
      inline: 'nearest',
    });
    firstOpenRef.current = false;
  }, [groupedMessages]);

  useEffect(() => {
    session.markAsRead();
  }, [session, groupedMessages]);

  const handleContextMenu = useCallback((e: MouseEvent, message: ChatMessage) => {
    e.preventDefault();
    setContextMenu({
      message,
      position: { x: e.clientX, y: e.clientY },
    });
  }, []);

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const handleCopyText = useCallback((message: ChatMessage) => {
    if (message.content.type === 'text') {
      navigator.clipboard.writeText(message.content.text);
    }
  }, []);

  const handleViewEditHistory = useCallback((message: ChatMessage) => {
    setEditHistoryTarget(message);
  }, []);

  const handleCloseEditHistory = useCallback(() => {
    setEditHistoryTarget(null);
  }, []);

  return (
    <>
      <div className="flex-1 overflow-y-auto px-4 py-2">
        {hasMessages ? (
          <>
            {groupedMessages.map(group => (
              <div key={group.date} className="relative">
                <DateSeparator text={group.date} />
                {group.messages.map((message, idx) => {
                  const { type } = message.content;

                  if (type === 'contactAdded' || type === 'leftChat') {
                    const peerName = message.peer.name.length > 16 ? `${message.peer.name.slice(0, 8)}...` : message.peer.name;
                    const text =
                      type === 'contactAdded'
                        ? message.status.direction === 'outgoing'
                          ? 'You approved the request'
                          : `${peerName} accepted the request`
                        : `${peerName} left the chat`;
                    return <ChatEventItem key={message.messageId} text={text} />;
                  }

                  const nextMessage = group.messages[idx + 1];
                  const isLastInGroup =
                    !nextMessage ||
                    nextMessage.content.type === 'contactAdded' ||
                    nextMessage.content.type === 'leftChat' ||
                    nextMessage.status.direction !== message.status.direction;
                  const isMe = message.status.direction === 'outgoing';
                  const productId = message.peer.type === 'product' ? message.peer.productId : 'unknown-product';

                  if (message.content.type === 'transfer') {
                    const content = message.content;
                    const Bubble = content.kind === 'coinage' ? CoinageTransferMessageBubble : TransferMessageBubble;
                    return (
                      <div
                        key={message.messageId}
                        className={cnTw('flex w-full flex-col py-0.5', { 'items-end': isMe, 'items-start': !isMe })}
                      >
                        <Bubble
                          message={message}
                          content={content}
                          isMe={isMe}
                          onContextMenu={e => handleContextMenu(e, message)}
                        />
                      </div>
                    );
                  }

                  if (message.content.type === 'callSignal') {
                    const content = message.content;
                    const fallback: CallState = { kind: 'calling' };
                    const callState = callStates.get(message.messageId) ?? fallback;
                    return (
                      <div
                        key={message.messageId}
                        className={cnTw('flex w-full flex-col py-0.5', { 'items-end': isMe, 'items-start': !isMe })}
                      >
                        <CallMessageBubble
                          message={message}
                          content={content}
                          state={callState}
                          isMe={isMe}
                          onContextMenu={e => handleContextMenu(e, message)}
                        />
                      </div>
                    );
                  }

                  const quotedMessage = (() => {
                    if (message.content.type !== 'reply') return null;
                    const found = messageMap.get(message.content.messageId);
                    if (found && found.content.type !== 'reply') return found;
                    // Fall back to the embedded content copy when the original isn't found
                    // or when the lookup returns a reply (mismatched peer message IDs)
                    return { ...message, content: message.content.content };
                  })();
                  return (
                    <div
                      key={message.messageId}
                      className={cnTw('flex w-full flex-col py-0.5', {
                        'items-end': isMe,
                        'items-start': !isMe,
                        'mb-2.5': (messageReactions.get(message.messageId)?.length ?? 0) > 0,
                      })}
                    >
                      <MessageBubble
                        productId={productId}
                        roomId={session.roomId}
                        message={message}
                        isMe={isMe}
                        isLastInGroup={isLastInGroup}
                        quotedMessage={quotedMessage}
                        reactions={messageReactions.get(message.messageId) ?? []}
                        editedText={latestEdits.get(message.messageId)?.text}
                        isEdited={latestEdits.has(message.messageId)}
                        onContextMenu={e => handleContextMenu(e, message)}
                        onToggleReaction={onToggleReaction}
                        onViewEditHistory={() => handleViewEditHistory(message)}
                      />
                    </div>
                  );
                })}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </>
        ) : (
          <div className="flex size-full flex-col items-center justify-center">
            <NoData
              icon={MessagesSquare}
              title={t('feature.chat.noMessages')}
              description={t('feature.chat.sendMessageToBegin')}
            />
          </div>
        )}
      </div>
      {contextMenu && (
        <MessageContextMenu
          message={contextMenu.message}
          position={contextMenu.position}
          isEdited={latestEdits.has(contextMenu.message.messageId)}
          onClose={handleCloseContextMenu}
          onReply={onReply}
          onEdit={msg => {
            const editText = latestEdits.get(msg.messageId)?.text ?? getPlainText(msg.content);
            onEdit(msg, editText);
          }}
          onCopyText={handleCopyText}
          onViewEditHistory={handleViewEditHistory}
          onToggleReaction={onToggleReaction}
        />
      )}
      {editHistoryTarget && (
        <EditHistory
          isOpen
          originalText={getPlainText(editHistoryTarget.content)}
          originalTimestamp={editHistoryTarget.timestamp}
          entries={editHistoryEntries}
          onClose={handleCloseEditHistory}
        />
      )}
    </>
  );
};

type MessageGroup = {
  date: string;
  messages: ChatMessage[];
};

function useGroupedMessages(messages: ChatMessage[]) {
  const sortedMessages = useMemo(() => {
    return Array.from(messages).sort((a, b) => a.timestamp - b.timestamp);
  }, [messages]);

  return useMemo((): MessageGroup[] => {
    const groups: MessageGroup[] = [];
    let currentDate = '';
    let currentGroup: ChatMessage[] = [];

    const formatDate = (timestamp: number): string => {
      const date = new Date(timestamp);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      if (date.toDateString() === today.toDateString()) {
        return 'Today';
      } else if (date.toDateString() === yesterday.toDateString()) {
        return 'Yesterday';
      } else {
        return date.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
      }
    };

    for (const message of sortedMessages) {
      const dateStr = formatDate(message.timestamp);
      if (dateStr !== currentDate) {
        if (currentGroup.length > 0) {
          groups.push({ date: currentDate, messages: currentGroup });
        }
        currentDate = dateStr;
        currentGroup = [message];
      } else {
        currentGroup.push(message);
      }
    }

    if (currentGroup.length > 0) {
      groups.push({ date: currentDate, messages: currentGroup });
    }

    return groups;
  }, [sortedMessages]);
}
