import { toastInfo } from '@novasamatech/tr-ui';
import { ChevronLeft, MessagesSquare } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import LastChatsIcon from '@/shared/assets/images/header/last-chats.svg?jsx';
import { widgetSpanWidthCss } from '@/shared/components';
import { TEST_IDS } from '@/shared/test-ids';
import { useTranslation } from '@/shared/translation';
import {
  type ChatMessage,
  type ChatSession,
  type P2PChatRequest,
  useHideRequestsByDefault,
  useMessageSearch,
  useProductSessions,
} from '@/domains/chat';
import {
  useAcceptRequest,
  useCancelOutgoingRequest,
  useDeclineRequest,
  useP2PChatManager,
  useP2PChatRequests,
  useP2PSessions,
  useRevealRequest,
  useSendChatRequest,
} from '@/aggregates/p2p-chat';
import { useTruapiUserId } from '@/aggregates/truapi-runtime';
import { useAnnounceProductRoomOpen } from '../hooks/useAnnounceProductRoomOpen';
import { useContactSearch } from '../hooks/useContactSearch';
import { useSortedChatList } from '../hooks/useSortedChatList';
import { useSortedSessions } from '../hooks/useSortedSessions';
import { chatService } from '../service';

import { SyncStatusBanner } from './SyncStatusBanner';
import { ChatItem } from './partials/ChatItem';
import { ChatItemSkeleton } from './partials/ChatItemSkeleton';
import { ChatListSearchBar } from './partials/ChatListSearchBar';
import { DraftInvitationRoom } from './partials/DraftInvitationRoom';
import { IncomingRequestRoom } from './partials/IncomingRequestRoom';
import { NewRequestsItem } from './partials/NewRequestsItem';
import { NoData } from './partials/NoData';
import { OutgoingPendingRoom } from './partials/OutgoingPendingRoom';
import { OutgoingRequestItem } from './partials/OutgoingRequestItem';
import { RecentContactsRow } from './partials/RecentContactsRow';
import { RequestConfirmDialog } from './partials/RequestConfirmDialog';
import { RequestItem } from './partials/RequestItem';
import { Room } from './partials/Room';
import { RoomList } from './partials/RoomList';
import { SearchResultsPanel } from './partials/SearchResultsPanel';

// How many recent-chat avatar chips to surface above the recents list on focus.
const RECENT_CHIP_COUNT = 12;

type JumpTarget = { sessionId: string; messageId: string; query: string };
type InviteTarget = { accountId: string; username: string };

type Props = {
  selected: string | null;
  onSelect(id: string): void;
  onDeselect?: VoidFunction;
};

// Match the chat list to a single widget column so it lines up with the settings side menu.
const sideMenuStyle = { width: widgetSpanWidthCss(1) };

export const ChatFullscreen = ({ selected, onSelect, onDeselect }: Props) => {
  const { t } = useTranslation();
  const userId = useTruapiUserId();
  const { data: productSessions, pending: pendingProduct } = useProductSessions(userId);
  const { data: p2pSessions, pending: pendingP2P } = useP2PSessions();
  const { data: pendingRequests, outgoing: outgoingRequests, cancelledIncoming } = useP2PChatRequests();
  const manager = useP2PChatManager();
  const acceptRequest = useAcceptRequest();
  const declineRequest = useDeclineRequest();
  const revealRequest = useRevealRequest();
  const cancelOutgoingRequest = useCancelOutgoingRequest();
  const sendChatRequest = useSendChatRequest();
  const { data: hideRequestsByDefault } = useHideRequestsByDefault();
  const { search, results: contactResults, pending: contactsPending, searchError } = useContactSearch();
  const [query, setQuery] = useState('');
  const { data: messageResults, pending: messagesPending } = useMessageSearch(query);
  const [searchActive, setSearchActive] = useState(false);
  // The peer chosen in search opens `draftInvitation`: the draft room where the single invitation
  // message is typed. Sending it creates the outgoing pending request.
  const [draftInvitation, setDraftInvitation] = useState<InviteTarget | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [jumpTarget, setJumpTarget] = useState<JumpTarget | null>(null);
  const [showRequests, setShowRequests] = useState(false);
  const [declineTarget, setDeclineTarget] = useState<P2PChatRequest | null>(null);
  const [declineOpen, setDeclineOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const leftPanelRef = useRef<HTMLDivElement>(null);

  useAnnounceProductRoomOpen(selected);

  const pending = pendingProduct || pendingP2P;
  const sessions = useMemo(
    () => chatService.excludePendingSessions([...productSessions, ...p2pSessions], outgoingRequests, pendingRequests),
    [productSessions, p2pSessions, outgoingRequests, pendingRequests],
  );
  const selectedSession = useMemo(() => sessions.find(c => c.sessionId === selected) ?? null, [sessions, selected]);
  const selectedOutgoingRequest = useMemo(
    () => outgoingRequests.find(r => r.peerId === selected) ?? null,
    [outgoingRequests, selected],
  );
  const selectedIncomingRequest = useMemo(
    () => pendingRequests.find(r => r.peerId === selected) ?? null,
    [pendingRequests, selected],
  );
  const selectedCancelledRequest = useMemo(
    () => chatService.findCancelledRequest(cancelledIncoming, selected),
    [cancelledIncoming, selected],
  );
  const pane = chatService.chooseRoomPane({
    hasDraft: draftInvitation !== null,
    outgoing: selectedOutgoingRequest,
    incoming: selectedIncomingRequest,
    session: selectedSession,
    cancelled: selectedCancelledRequest,
  });
  const requesterNames = useMemo(() => chatService.formatRequesterNames(pendingRequests), [pendingRequests]);
  const connectedIds = useMemo(() => new Set(sessions.map(s => s.sessionId)), [sessions]);
  const chatListEntries = useSortedChatList(sessions, outgoingRequests, pendingRequests);

  const closeSearch = useCallback(() => {
    setSearchActive(false);
    setQuery('');
    search('');
    // Drop focus too: a retained focus with searchActive=false would swallow
    // further typing (onFocus wouldn't re-fire to reactivate the panel).
    searchInputRef.current?.blur();
  }, [search]);

  // Close on click outside the chat list column; inside clicks are safe since result rows close it themselves.
  useEffect(() => {
    if (!searchActive) return;
    const handleMouseDown = (event: globalThis.MouseEvent) => {
      if (leftPanelRef.current && event.target instanceof Node && !leftPanelRef.current.contains(event.target)) {
        closeSearch();
      }
    };
    document.addEventListener('mousedown', handleMouseDown);

    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [searchActive, closeSearch]);

  const handleQueryChange = useCallback(
    (value: string) => {
      setQuery(value);
      search(value);
    },
    [search],
  );

  const handleClearSearch = useCallback(() => {
    if (query.trim().length > 0) {
      setQuery('');
      search('');
      searchInputRef.current?.focus();

      return;
    }
    closeSearch();
  }, [query, search, closeSearch]);

  const handleSelectSession = useCallback(
    (session: ChatSession) => {
      setJumpTarget(null);
      onSelect(session.sessionId);
      closeSearch();
    },
    [onSelect, closeSearch],
  );

  const handleSelectMessage = useCallback(
    (message: ChatMessage) => {
      setJumpTarget({ sessionId: message.sessionId, messageId: message.messageId, query });
      onSelect(message.sessionId);
      closeSearch();
    },
    [onSelect, closeSearch, query],
  );

  const handleSelectContact = useCallback(
    (accountId: string, username: string) => {
      setDraftInvitation({ accountId, username });
      setInviteError(null);
      closeSearch();
      onDeselect?.();
    },
    [closeSearch, onDeselect],
  );

  const handleSendInvitation = useCallback(
    async (text: string) => {
      if (!draftInvitation) return;
      const { accountId, username } = draftInvitation;
      setInviteError(null);
      // The single invitation message is the request's welcome message; sending it creates the
      // outgoing pending request, after which the draft closes and the pending room opens.
      try {
        await sendChatRequest(accountId, username, text.trim() || undefined);
      } catch (e) {
        console.error('[chat] Failed to send chat request:', e);
        setInviteError(t('feature.chat.request.inviteFailed'));
        // Rethrow so MessageInput keeps the draft (it clears only on success).
        throw e;
      }
      setDraftInvitation(null);
      onSelect(accountId);
    },
    [draftInvitation, sendChatRequest, onSelect, t],
  );

  const handleCancelDraft = useCallback(() => {
    setDraftInvitation(null);
    setInviteError(null);
    onDeselect?.();
  }, [onDeselect]);

  const roomInitialSearch = useMemo(
    () =>
      jumpTarget && jumpTarget.sessionId === selected ? { query: jumpTarget.query, messageId: jumpTarget.messageId } : undefined,
    [jumpTarget, selected],
  );

  const showResults = searchActive && query.trim().length > 0;
  const showRecents = searchActive && query.trim().length === 0;

  const handleAcceptRequest = useCallback(
    async (request: P2PChatRequest) => {
      try {
        await acceptRequest(request.requestId);
        setShowRequests(false);
        onSelect(request.peerId);
      } catch (e) {
        console.error('[chat] Failed to accept request:', e);
      }
    },
    [acceptRequest, onSelect],
  );

  const handleRevealRequest = useCallback(
    async (request: P2PChatRequest) => {
      try {
        await revealRequest(request.requestId);
      } catch (e) {
        console.error('[chat] Failed to reveal request:', e);
      }
    },
    [revealRequest],
  );

  const openDecline = useCallback((request: P2PChatRequest) => {
    setDeclineTarget(request);
    setDeclineOpen(true);
  }, []);

  const handleDeclineConfirm = useCallback(async () => {
    if (!declineTarget) return;
    const name = chatService.formatPeerName(declineTarget.peerUsername, declineTarget.peerId);
    const wasSelected = declineTarget.peerId === selected;
    try {
      await declineRequest(declineTarget.requestId);
      toastInfo({ title: t('feature.chat.request.declinedToast', { name }) });
      if (wasSelected) onDeselect?.();
    } catch (e) {
      console.error('[chat] Failed to decline request:', e);
    }
    setDeclineOpen(false);
  }, [declineRequest, declineTarget, selected, onDeselect, t]);

  const handleCancelOutgoingRequest = useCallback(
    async (request: P2PChatRequest) => {
      try {
        await cancelOutgoingRequest(request.requestId, request.peerId);
        onDeselect?.();
      } catch (e) {
        console.error('[chat] Failed to cancel outgoing request:', e);
      }
    },
    [cancelOutgoingRequest, onDeselect],
  );

  return (
    <div className="relative flex size-full gap-2 bg-bg-surface-main p-2">
      <div
        ref={leftPanelRef}
        style={sideMenuStyle}
        className="flex shrink-0 flex-col overflow-hidden rounded-xl border border-stroke-primary bg-bg-surface-container"
      >
        {showRequests ? (
          <RequestsListView
            requests={pendingRequests}
            selected={selected}
            hideByDefault={hideRequestsByDefault}
            onBack={() => setShowRequests(false)}
            onSelect={onSelect}
            onDecline={openDecline}
          />
        ) : (
          <>
            <ListHeader />
            <ChatListSearchBar
              query={query}
              active={searchActive}
              inputRef={searchInputRef}
              onQueryChange={handleQueryChange}
              onFocus={() => setSearchActive(true)}
              onClear={handleClearSearch}
              onEscape={closeSearch}
            />
            {showResults ? (
              <SearchResultsPanel
                query={query}
                sessions={sessions}
                contactResults={contactResults}
                messageResults={messageResults}
                connectedIds={connectedIds}
                contactsDisabled={!manager}
                pending={contactsPending || messagesPending}
                searchError={searchError}
                onSelectSession={handleSelectSession}
                onSelectContact={handleSelectContact}
                onSelectMessage={handleSelectMessage}
              />
            ) : showRecents ? (
              <RecentsView sessions={sessions} selectedSession={selectedSession} onSelect={handleSelectSession} />
            ) : (
              <div data-testid={TEST_IDS.chatRoomList} className="flex flex-1 flex-col overflow-y-auto">
                <SyncStatusBanner />
                {pending ? (
                  skeleton
                ) : chatListEntries.length === 0 ? (
                  <div className="flex h-full items-center justify-center">
                    <NoData
                      icon={MessagesSquare}
                      title={t('feature.chat.noChatsYet')}
                      description={t('feature.chat.yourChatsWillAppear')}
                    />
                  </div>
                ) : (
                  chatListEntries.map((entry, index) => {
                    if (entry.kind === 'incoming') {
                      return (
                        <NewRequestsItem
                          key="incoming-requests"
                          count={entry.requests.length}
                          subtitle={requesterNames}
                          onClick={() => setShowRequests(true)}
                        />
                      );
                    }
                    if (entry.kind === 'outgoing') {
                      return (
                        <OutgoingRequestItem
                          key={entry.request.requestId}
                          request={entry.request}
                          selected={selected === entry.request.peerId}
                          onClick={() => onSelect(entry.request.peerId)}
                        />
                      );
                    }

                    return (
                      <ChatItem
                        key={entry.session.sessionId}
                        session={entry.session}
                        isLast={index === chatListEntries.length - 1}
                        isSelected={selectedSession?.sessionId === entry.session.sessionId}
                        onClick={() => onSelect(entry.session.sessionId)}
                      />
                    );
                  })
                )}
              </div>
            )}
          </>
        )}
      </div>

      {pane.kind === 'draft' && draftInvitation ? (
        <DraftInvitationRoom
          name={draftInvitation.username}
          sendError={inviteError}
          onSend={handleSendInvitation}
          onCancel={handleCancelDraft}
        />
      ) : pane.kind === 'outgoing' ? (
        <OutgoingPendingRoom request={pane.request} onCancel={handleCancelOutgoingRequest} />
      ) : pane.kind === 'incoming' ? (
        <IncomingRequestRoom
          request={pane.request}
          hideByDefault={hideRequestsByDefault}
          disabled={!manager}
          onAccept={() => handleAcceptRequest(pane.request)}
          onDecline={() => openDecline(pane.request)}
          onReveal={handleRevealRequest}
        />
      ) : pane.kind === 'session' ? (
        <Room session={pane.session} initialSearch={roomInitialSearch} onDeleted={onDeselect} />
      ) : pane.kind === 'cancelled' ? (
        <IncomingRequestRoom
          cancelled
          request={pane.request}
          hideByDefault={hideRequestsByDefault}
          onReveal={handleRevealRequest}
        />
      ) : (
        <NoData icon={MessagesSquare} title={t('feature.chat.noChatSelected')} description={t('feature.chat.selectChatToView')} />
      )}

      <RequestConfirmDialog
        isOpen={declineOpen}
        title={t('feature.chat.request.declineTitle')}
        description={t('feature.chat.request.declineBody', {
          name: declineTarget ? chatService.formatPeerName(declineTarget.peerUsername, declineTarget.peerId) : '',
        })}
        cancelLabel={t('feature.chat.request.cancel')}
        confirmLabel={t('feature.chat.request.decline')}
        testId={TEST_IDS.chatDeclineDialog}
        confirmTestId={TEST_IDS.chatDeclineDialogConfirm}
        onClose={() => setDeclineOpen(false)}
        onConfirm={handleDeclineConfirm}
      />
    </div>
  );
};

const ListHeader = () => {
  const { t } = useTranslation();

  return (
    <div className="shrink-0 bg-bg-surface-container p-2">
      <div className="flex w-full items-center gap-2">
        <LastChatsIcon className="size-6 shrink-0 dark:invert" aria-hidden />
        <span className="text-sm leading-5 font-semibold text-fg-primary">{t('feature.chat.fullscreenTitle')}</span>
      </div>
    </div>
  );
};

type RecentsViewProps = {
  sessions: ChatSession[];
  selectedSession: ChatSession | null;
  onSelect(session: ChatSession): void;
};

// Sorting lives here, not the parent, so the `lastMessage` subscription only runs while recents are on screen.
const RecentsView = ({ sessions, selectedSession, onSelect }: RecentsViewProps) => {
  const { t } = useTranslation();
  const recentSessions = useSortedSessions(sessions);

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <RecentContactsRow sessions={recentSessions.slice(0, RECENT_CHIP_COUNT)} onSelect={onSelect} />
      <div className="shrink-0 px-4 pt-1 pb-1">
        <span className="text-sm leading-5 font-medium text-fg-secondary">{t('feature.chat.recent')}</span>
      </div>
      <RoomList sessions={sessions} selected={selectedSession} onSelect={onSelect} />
    </div>
  );
};

type RequestsListViewProps = {
  requests: P2PChatRequest[];
  selected: string | null;
  hideByDefault: boolean;
  onBack: VoidFunction;
  onSelect: (peerId: string) => void;
  onDecline: (request: P2PChatRequest) => void;
};

const RequestsListView = ({ requests, selected, hideByDefault, onBack, onSelect, onDecline }: RequestsListViewProps) => {
  const { t } = useTranslation();

  return (
    <>
      <div className="shrink-0 bg-bg-surface-container p-2">
        <div className="flex w-full items-center gap-2">
          <button
            className="flex size-6 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-bg-selection-container-hover"
            onClick={onBack}
          >
            <ChevronLeft className="size-4 text-fg-secondary" />
          </button>
          <span className="min-w-0 flex-1 truncate text-sm leading-5 font-semibold text-fg-primary">
            {t('feature.chat.request.entryTitle')}
          </span>
        </div>
      </div>
      <div className="px-2 pt-2 pb-1">
        <div className="rounded-lg bg-bg-surface-nested px-4 py-3 text-center text-sm leading-4.5 text-fg-secondary">
          {t('feature.chat.request.listHint')}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {requests.map(req => (
          <RequestItem
            key={req.requestId}
            request={req}
            selected={selected === req.peerId}
            hideByDefault={hideByDefault}
            onSelect={() => onSelect(req.peerId)}
            onDecline={() => onDecline(req)}
          />
        ))}
      </div>
    </>
  );
};

// eslint-disable-next-line react/no-array-index-key
const skeleton = Array.from({ length: 8 }).map((_, index) => <ChatItemSkeleton key={index} />);
