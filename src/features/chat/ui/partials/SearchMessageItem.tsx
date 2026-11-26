import { TEST_IDS } from '@/shared/test-ids';
import { type ChatMessage } from '@/domains/chat';
import { chatService } from '../../service';

import { Avatar } from './Avatar';
import { renderHighlighted } from './highlight';

type Props = {
  message: ChatMessage;
  text: string;
  query: string;
  onSelect(message: ChatMessage): void;
};

export const SearchMessageItem = ({ message, text, query, onSelect }: Props) => {
  const name = message.peer.name || 'Unknown';

  return (
    <button
      data-testid={TEST_IDS.contactSearchMessageItem}
      className="flex w-full shrink-0 items-start gap-3 p-3 text-start transition-colors hover:bg-bg-selection-container-hover"
      onClick={() => onSelect(message)}
    >
      <Avatar name={name} size="chat-list" />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex w-full items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-fg-primary">{name}</span>
          <span className="shrink-0 text-xs text-fg-tertiary">{chatService.formatLastMessageDate(message.timestamp)}</span>
        </div>
        <span className="line-clamp-2 text-sm text-fg-secondary">{renderHighlighted(text, query)}</span>
      </div>
    </button>
  );
};
