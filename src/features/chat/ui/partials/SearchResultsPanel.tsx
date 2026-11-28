import { useMemo } from 'react';
import { useObservable } from 'react-rx';
import { combineLatest, map, of } from 'rxjs';

import { Avatar, EmptyState, ListItem, SectionLabel } from '@/shared/components';
import { LoaderCircleIcon, SearchXIcon } from '@/shared/icons';
import { TEST_IDS } from '@/shared/test-ids';
import { useTranslation } from '@/shared/translation';
import { type ChatMessage, type ChatSession, type MessageSearchHit, type SearchResult } from '@/domains/chat';
import { useLastMessagePreview } from '../../hooks/useLastMessagePreview';
import { chatService } from '../../service';
import { highlightMatch } from '../helpers/highlight';

import { PreviewIcon } from './PreviewIcon';

type Props = {
  query: string;
  sessions: ChatSession[];
  contactResults: SearchResult[];
  messageResults: MessageSearchHit[];
  connectedIds: Set<string>;
  contactsDisabled: boolean;
  pending: boolean;
  searchError: string | null;
  onSelectSession(session: ChatSession): void;
  onSelectContact(accountId: string, username: string): void;
  onSelectMessage(message: ChatMessage): void;
};

type NamedSession = { session: ChatSession; name: string };

const useSessionsWithNames = (sessions: ChatSession[]): NamedSession[] => {
  const named$ = useMemo(() => {
    if (sessions.length === 0) return of<NamedSession[]>([]);

    return combineLatest(
      sessions.map(s => s.name.pipe(map(name => ({ session: s, name: chatService.formatPeerName(name, s.roomId) })))),
    );
  }, [sessions]);

  return useObservable(named$, []);
};

export const SearchResultsPanel = ({
  query,
  sessions,
  contactResults,
  messageResults,
  connectedIds,
  contactsDisabled,
  pending,
  searchError,
  onSelectSession,
  onSelectContact,
  onSelectMessage,
}: Props) => {
  const { t } = useTranslation();
  const namedSessions = useSessionsWithNames(sessions);
  const needle = query.trim().toLowerCase();

  const matchedSessions = useMemo(
    () => namedSessions.filter(({ name }) => name.toLowerCase().includes(needle)),
    [namedSessions, needle],
  );

  // Existing chats already surface under matched sessions; drop contacts that
  // are already a chat so the section doesn't list the same peer twice.
  const newContacts = useMemo(
    () => contactResults.filter(result => !connectedIds.has(result.accountId)),
    [contactResults, connectedIds],
  );

  const hasChatsAndContacts = matchedSessions.length > 0 || newContacts.length > 0;
  const hasMessages = messageResults.length > 0;

  if (!hasChatsAndContacts && !hasMessages) {
    // A hit can still be in flight (debounced contact/message search); don't
    // flash "no results" or swallow a search error as an empty set.
    if (pending) {
      return (
        <div className="flex flex-1 items-center justify-center p-8">
          <LoaderCircleIcon className="size-4 animate-spin text-fg-tertiary" />
        </div>
      );
    }

    return <EmptyState icon={<SearchXIcon />} title={searchError || t('feature.chat.noResults', { query })} />;
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      {hasChatsAndContacts && (
        <>
          <SectionHeader label={t('feature.chat.searchChatsAndContacts')} />
          {matchedSessions.map(({ session, name }) => (
            <SessionResultRow
              key={session.sessionId}
              session={session}
              name={name}
              query={query}
              onSelect={() => onSelectSession(session)}
            />
          ))}
          {newContacts.map(result => (
            <ContactResultRow
              key={result.accountId + result.username + result.status}
              username={result.username}
              query={query}
              disabled={contactsDisabled}
              onSelect={() => onSelectContact(result.accountId, result.username)}
            />
          ))}
        </>
      )}

      {hasMessages && (
        <>
          <SectionHeader label={t('feature.chat.searchMessages')} />
          {messageResults.map(hit => (
            <MessageResultRow key={hit.message.messageId} hit={hit} query={query} onSelect={() => onSelectMessage(hit.message)} />
          ))}
        </>
      )}
    </div>
  );
};

const SectionHeader = ({ label }: { label: string }) => (
  <div className="px-3 pt-3 pb-1">
    <SectionLabel>{label}</SectionLabel>
  </div>
);

type SessionResultRowProps = {
  session: ChatSession;
  name: string;
  query: string;
  onSelect: VoidFunction;
};

const SessionResultRow = ({ session, name, query, onSelect }: SessionResultRowProps) => {
  const { text: preview, icon: previewIcon } = useLastMessagePreview(session);

  return (
    <ListItem
      icon={<Avatar label={name} size="40" />}
      label={<span>{highlightMatch(name, query)}</span>}
      description={
        preview ? (
          <span>
            <PreviewIcon kind={previewIcon} />
            {preview}
          </span>
        ) : null
      }
      onClick={onSelect}
    />
  );
};

type ContactResultRowProps = {
  username: string;
  query: string;
  disabled: boolean;
  onSelect: VoidFunction;
};

const ContactResultRow = ({ username, query, disabled, onSelect }: ContactResultRowProps) => (
  <ListItem
    icon={<Avatar label={username} size="40" />}
    label={<span>{highlightMatch(username, query)}</span>}
    chevron
    disabled={disabled}
    testId={TEST_IDS.contactResultItem}
    onClick={onSelect}
  />
);

type MessageResultRowProps = {
  hit: MessageSearchHit;
  query: string;
  onSelect: VoidFunction;
};

const MessageResultRow = ({ hit, query, onSelect }: MessageResultRowProps) => {
  const { message, text } = hit;
  const name = chatService.formatPeerName(message.peer.name, message.sessionId);

  return (
    <ListItem
      icon={<Avatar label={name} size="40" />}
      label={name}
      description={<span>{highlightMatch(text, query)}</span>}
      meta={chatService.formatLastMessageDate(message.timestamp)}
      onClick={onSelect}
    />
  );
};
