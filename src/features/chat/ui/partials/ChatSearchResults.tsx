import { cnTw } from '@/shared/utils';
import { type ChatMessage, chatMessageService } from '@/domains/chat';
import { chatService } from '../../service';
import { highlightMatch } from '../helpers/highlight';

import { Avatar } from './Avatar';

type Props = {
  query: string;
  results: ChatMessage[];
  activeMessageId: string | null;
  peerName: string;
  currentUserName: string;
  onSelect(message: ChatMessage): void;
};

export const ChatSearchResults = ({ query, results, activeMessageId, peerName, currentUserName, onSelect }: Props) => {
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
        const name = (message.status.direction === 'outgoing' ? currentUserName : peerName) || 'Unknown';
        const text = chatMessageService.getSearchableText(message.content);
        return (
          <button
            key={message.messageId}
            className={cnTw(
              'relative flex w-full items-start gap-3 p-3 text-start transition-colors after:absolute after:start-15 after:end-3 after:bottom-0 after:h-px after:bg-stroke-secondary hover:bg-bg-selection-container-hover',
              isActive && 'bg-bg-selection-container-active',
            )}
            onClick={() => onSelect(message)}
          >
            <Avatar name={name} size="chat-header" />
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex w-full items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-fg-primary">{name}</span>
                <span className="shrink-0 text-xs text-fg-tertiary">{chatService.formatLastMessageDate(message.timestamp)}</span>
              </div>
              <span className="line-clamp-2 text-sm text-fg-secondary">{highlightMatch(text, query)}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
};
