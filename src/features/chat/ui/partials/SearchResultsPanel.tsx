import { ChevronRight, Loader2 } from 'lucide-react';
import { useMemo } from 'react';
import { useObservable } from 'react-rx';
import { combineLatest, map, of } from 'rxjs';

import { TEST_IDS } from '@/shared/test-ids';
import { useTranslation } from '@/shared/translation';
import { type ChatMessage, type ChatSession, type MessageSearchHit, type SearchResult } from '@/domains/chat';
import { useLastMessagePreview } from '../../hooks/useLastMessagePreview';
import { chatService } from '../../service';
import { highlightMatch } from '../helpers/highlight';

import { Avatar } from './Avatar';
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
          <Loader2 className="size-4 animate-spin text-fg-tertiary" />
        </div>
      );
    }

    return (
      <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-fg-secondary">
        {searchError ? <span className="text-fg-error">{searchError}</span> : t('feature.chat.noResults', { query })}
      </div>
    );
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
  <div className="shrink-0 px-4 pt-3 pb-1">
    <span className="text-sm font-medium text-fg-secondary">{label}</span>
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
    <button
      className="flex w-full shrink-0 items-center gap-3 p-3 text-start transition-colors hover:bg-bg-selection-container-hover"
      onClick={onSelect}
    >
      <Avatar name={name} size="chat-list-compact" />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="min-w-0 truncate text-base font-semibold text-fg-primary">{highlightMatch(name, query)}</span>
        {preview && (
          <div className="flex min-w-0 items-center gap-1">
            <PreviewIcon kind={previewIcon} className="text-fg-secondary" />
            <span className="line-clamp-1 min-w-0 flex-1 text-sm text-fg-secondary">{preview}</span>
          </div>
        )}
      </div>
    </button>
  );
};

type ContactResultRowProps = {
  username: string;
  query: string;
  disabled: boolean;
  onSelect: VoidFunction;
};

const ContactResultRow = ({ username, query, disabled, onSelect }: ContactResultRowProps) => (
  <button
    data-testid={TEST_IDS.contactResultItem}
    className="flex w-full shrink-0 items-center gap-3 p-3 text-start transition-colors hover:bg-bg-selection-container-hover disabled:opacity-50"
    disabled={disabled}
    onClick={onSelect}
  >
    <Avatar name={username} size="chat-list-compact" />
    <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
      <span className="min-w-0 flex-1 truncate text-base font-semibold text-fg-primary">{highlightMatch(username, query)}</span>
      <ChevronRight className="size-4 shrink-0 text-fg-tertiary" />
    </div>
  </button>
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
    <button
      className="flex w-full shrink-0 items-start gap-3 p-3 text-start transition-colors hover:bg-bg-selection-container-hover"
      onClick={onSelect}
    >
      <Avatar name={name} size="chat-list-compact" />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex w-full items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-base font-semibold text-fg-primary">{name}</span>
          <span className="shrink-0 text-sm font-medium text-fg-tertiary">
            {chatService.formatLastMessageDate(message.timestamp)}
          </span>
        </div>
        <span className="line-clamp-2 text-sm text-fg-secondary">{highlightMatch(text, query)}</span>
      </div>
    </button>
  );
};
