import { SearchX } from 'lucide-react';

import { Avatar, EmptyState, ListItem } from '@/shared/components';
import { useTranslation } from '@/shared/translation';
import { type ChatMessage, chatMessageService } from '@/domains/chat';
import { chatService } from '../../service';
import { highlightMatch } from '../helpers/highlight';

type Props = {
  query: string;
  results: ChatMessage[];
  activeMessageId: string | null;
  peerName: string;
  currentUserName: string;
  onSelect(message: ChatMessage): void;
};

export const ChatSearchResults = ({ query, results, activeMessageId, peerName, currentUserName, onSelect }: Props) => {
  const { t } = useTranslation();

  if (results.length === 0) {
    return <EmptyState icon={<SearchX />} title={t('feature.chat.inChatSearch.noMatches')} />;
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {results.map(message => {
        const name = (message.status.direction === 'outgoing' ? currentUserName : peerName) || t('common.status.unknownUser');
        const text = chatMessageService.getSearchableText(message.content);
        return (
          <ListItem
            key={message.messageId}
            icon={<Avatar label={name} size="40" />}
            label={name}
            description={<span>{highlightMatch(text, query)}</span>}
            meta={chatService.formatLastMessageDate(message.timestamp)}
            selected={activeMessageId === message.messageId}
            onClick={() => onSelect(message)}
          />
        );
      })}
    </div>
  );
};
