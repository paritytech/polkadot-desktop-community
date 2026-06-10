import { cnTw } from '@/shared/utils';
import { type ChatMessage } from '@/domains/chat';
import { formatLastMessageDate } from '../helpers/message';

import { Avatar } from './Avatar';

type Props = {
  query: string;
  results: ChatMessage[];
  activeMessageId: string | null;
  onSelect(message: ChatMessage): void;
};

const renderHighlighted = (text: string, query: string) => {
  const trimmed = query.trim();
  if (!trimmed) return text;
  const lower = text.toLowerCase();
  const q = trimmed.toLowerCase();
  const parts: { text: string; match: boolean }[] = [];
  let cursor = 0;
  let idx = lower.indexOf(q, cursor);
  while (idx !== -1) {
    if (idx > cursor) parts.push({ text: text.slice(cursor, idx), match: false });
    parts.push({ text: text.slice(idx, idx + q.length), match: true });
    cursor = idx + q.length;
    idx = lower.indexOf(q, cursor);
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor), match: false });
  return parts.map((part, i) =>
    part.match ? (
      // eslint-disable-next-line react/no-array-index-key
      <mark key={i} className="bg-bg-status-warning text-fg-primary">
        {part.text}
      </mark>
    ) : (
      // eslint-disable-next-line react/no-array-index-key
      <span key={i}>{part.text}</span>
    ),
  );
};

const messagePlainText = (message: ChatMessage): string => {
  const { content } = message;
  switch (content.type) {
    case 'text':
      return content.text;
    case 'richText':
      return content.text ?? '';
    case 'reply':
      return content.content.type === 'text' ? content.content.text : '';
    case 'edit':
      return content.newContent.text ?? '';
    default:
      return '';
  }
};

export const ChatSearchResults = ({ query, results, activeMessageId, onSelect }: Props) => {
  if (results.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-fg-secondary">
        No matching messages
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {results.map(message => {
        const isActive = activeMessageId === message.messageId;
        const name = message.peer.name || 'Unknown';
        const text = messagePlainText(message);
        return (
          <button
            key={message.messageId}
            className={cnTw(
              'relative flex w-full items-start gap-3 p-3 text-left transition-colors after:absolute after:right-3 after:bottom-0 after:left-15 after:h-px after:bg-border-divider hover:bg-bg-selection-container-hover',
              isActive && 'bg-bg-selection-container-active',
            )}
            onClick={() => onSelect(message)}
          >
            <Avatar name={name} size="chat-header" />
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex w-full items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-sm leading-5 font-semibold text-fg-primary">{name}</span>
                <span className="shrink-0 text-xs leading-4 text-fg-tertiary">{formatLastMessageDate(message.timestamp)}</span>
              </div>
              <span className="line-clamp-2 text-sm leading-[18px] text-fg-secondary">{renderHighlighted(text, query)}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
};
