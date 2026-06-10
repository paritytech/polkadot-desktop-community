import { Button, DropdownMenu } from '@novasamatech/tr-ui';
import { ChevronLeft, Ellipsis, MessageSquare, MessagesSquare, Search, Timer, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { widgetSpanWidthCss } from '@/shared/components';
import { TEST_IDS } from '@/shared/test-ids';
import { useTranslation } from '@/shared/translation';
import { cnTw } from '@/shared/utils';
import {
  type P2PChatRequest,
  useAcceptRequest,
  useCancelOutgoingRequest,
  useDeclineRequest,
  useP2PChatManager,
  useP2PRequests,
  useP2PSessions,
  useProductSessions,
} from '@/domains/chat';

import { ContactSearch } from './ContactSearch';
import { Avatar } from './partials/Avatar';
import { ChatItemSkeleton } from './partials/ChatItemSkeleton';
import { DeclineDialog } from './partials/DeclineDialog';
import { MessageInput } from './partials/MessageInput';
import { NoData } from './partials/NoData';
import { Room } from './partials/Room';
import { RoomList } from './partials/RoomList';

type Props = {
  selected: string | null;
  onSelect(id: string): void;
  onDeselect?: VoidFunction;
};

// Match the chat list to a single widget column so it lines up with the settings side menu.
const sideMenuStyle = { width: widgetSpanWidthCss(1) };

export const ChatFullscreen = ({ selected, onSelect, onDeselect }: Props) => {
  const { t } = useTranslation();
  const { data: productSessions, pending: pendingProduct } = useProductSessions();
  const { data: p2pSessions, pending: pendingP2P } = useP2PSessions();
  const { data: pendingRequests, outgoing: outgoingRequests } = useP2PRequests();
  const manager = useP2PChatManager();
  const acceptRequest = useAcceptRequest();
  const declineRequest = useDeclineRequest();
  const cancelOutgoingRequest = useCancelOutgoingRequest();
  const [showSearch, setShowSearch] = useState(false);
  const [showRequests, setShowRequests] = useState(false);
  const [declineTarget, setDeclineTarget] = useState<P2PChatRequest | null>(null);

  const pending = pendingProduct || pendingP2P;
  const pendingPeerIds = useMemo(
    () => new Set([...outgoingRequests.map(r => r.peerId), ...pendingRequests.map(r => r.peerId)]),
    [outgoingRequests, pendingRequests],
  );
  const sessions = useMemo(
    () => [...productSessions, ...p2pSessions].filter(s => !pendingPeerIds.has(s.sessionId)),
    [productSessions, p2pSessions, pendingPeerIds],
  );
  const selectedSession = useMemo(() => sessions.find(c => c.sessionId === selected) ?? null, [sessions, selected]);
  const selectedOutgoingRequest = useMemo(
    () => outgoingRequests.find(r => r.peerId === selected) ?? null,
    [outgoingRequests, selected],
  );

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

  const handleDeclineConfirm = useCallback(async () => {
    if (!declineTarget) return;
    try {
      await declineRequest(declineTarget.requestId);
    } catch (e) {
      console.error('[chat] Failed to decline request:', e);
    }
    setDeclineTarget(null);
  }, [declineRequest, declineTarget]);

  const handleRemoveOutgoingRequest = useCallback(
    async (request: P2PChatRequest) => {
      try {
        await cancelOutgoingRequest(request.requestId, request.peerId);
        onDeselect?.();
      } catch (e) {
        console.error('[chat] Failed to remove outgoing request:', e);
      }
    },
    [cancelOutgoingRequest, onDeselect],
  );

  return (
    <div className="relative flex size-full gap-2 bg-bg-surface-main p-2">
      <div
        style={sideMenuStyle}
        className="flex shrink-0 flex-col overflow-hidden rounded-xl border border-border-primary bg-bg-surface-container"
      >
        {showRequests ? (
          <RequestsListView
            requests={pendingRequests}
            disabled={!manager}
            onBack={() => setShowRequests(false)}
            onAccept={handleAcceptRequest}
            onDecline={setDeclineTarget}
          />
        ) : (
          <>
            <ListHeader showSearch={showSearch} onNewChat={() => setShowSearch(s => !s)} />
            {showSearch ? (
              <ContactSearch
                onClose={() => setShowSearch(false)}
                onRequestSent={peerId => {
                  setShowSearch(false);
                  onSelect(peerId);
                }}
              />
            ) : (
              <div data-testid={TEST_IDS.chatRoomList} className="flex-1 overflow-y-auto">
                {pendingRequests.length > 0 && (
                  <NewRequestsItem count={pendingRequests.length} onClick={() => setShowRequests(true)} />
                )}
                {outgoingRequests.map(req => (
                  <OutgoingRequestItem
                    key={req.requestId}
                    request={req}
                    selected={selected === req.peerId}
                    onClick={() => onSelect(req.peerId)}
                  />
                ))}
                {pending ? (
                  skeleton
                ) : (
                  <RoomList
                    sessions={sessions}
                    selected={selectedSession}
                    hideEmpty={outgoingRequests.length > 0 || pendingRequests.length > 0}
                    onSelect={s => onSelect(s.sessionId)}
                  />
                )}
              </div>
            )}
          </>
        )}
      </div>

      {selectedOutgoingRequest ? (
        <OutgoingPendingRoom
          request={selectedOutgoingRequest}
          onRemove={() => handleRemoveOutgoingRequest(selectedOutgoingRequest)}
        />
      ) : selectedSession ? (
        <Room session={selectedSession} onDeleted={onDeselect} />
      ) : (
        <NoData icon={MessagesSquare} title={t('feature.chat.noChatSelected')} description={t('feature.chat.selectChatToView')} />
      )}

      <DeclineDialog
        isOpen={declineTarget !== null}
        peerName={declineTarget?.peerUsername ?? declineTarget?.peerId.slice(0, 12) ?? ''}
        onClose={() => setDeclineTarget(null)}
        onDecline={handleDeclineConfirm}
      />
    </div>
  );
};

const ListHeader = ({ onNewChat, showSearch }: { onNewChat: VoidFunction; showSearch: boolean }) => {
  const { t } = useTranslation();

  return (
    <div className="shrink-0 bg-bg-surface-container p-2">
      <div className="flex w-full items-center gap-2">
        <div className="flex flex-1 items-center gap-2">
          <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-bg-illustration-dark">
            <MessageSquare className="size-3.5 text-fg-primary-inverted" />
          </div>
          <span className="shrink-0 text-sm leading-5 font-semibold text-fg-primary">{t('feature.chat.title')}</span>
        </div>
        <button
          data-testid={TEST_IDS.chatSearchToggleButton}
          className={cnTw(
            'flex size-7 items-center justify-center rounded-full transition-colors hover:bg-bg-selection-container-hover',
            showSearch && 'bg-bg-selection-container-active',
          )}
          onMouseDown={showSearch ? e => e.stopPropagation() : undefined}
          onClick={onNewChat}
        >
          <Search className="size-4 text-fg-secondary" />
        </button>
      </div>
    </div>
  );
};

const NewRequestsItem = ({ count, onClick }: { count: number; onClick: VoidFunction }) => {
  return (
    <div
      data-testid={TEST_IDS.chatNewRequestsItem}
      className="relative flex h-22 w-full cursor-pointer items-center gap-3 p-3 transition-colors after:absolute after:right-3 after:bottom-0 after:left-22 after:h-px after:bg-border-divider hover:bg-bg-selection-container-hover"
      onClick={onClick}
    >
      <div className="flex size-16 shrink-0 items-center justify-center rounded-full bg-bg-illustration-dark">
        <MessageSquare className="size-7 text-fg-primary-inverted" />
      </div>
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {/* eslint-disable-next-line formatjs/no-literal-string-in-jsx */}
        <span className="min-w-0 flex-1 truncate text-base leading-6 font-semibold text-fg-primary">New Requests</span>
        <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-bg-illustration-dark px-1">
          <span className="text-center text-xs leading-4 font-semibold tracking-[1px] text-fg-primary-inverted uppercase">
            {count}
          </span>
        </span>
      </div>
    </div>
  );
};

type RequestsListViewProps = {
  requests: P2PChatRequest[];
  disabled: boolean;
  onBack: VoidFunction;
  onAccept: (request: P2PChatRequest) => void;
  onDecline: (request: P2PChatRequest) => void;
};

const RequestsListView = ({ requests, disabled, onBack, onAccept, onDecline }: RequestsListViewProps) => {
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
          <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-bg-illustration-dark">
            <MessageSquare className="size-3.5 text-fg-primary-inverted" />
          </div>
          {/* eslint-disable-next-line formatjs/no-literal-string-in-jsx */}
          <span className="min-w-0 flex-1 truncate text-sm leading-5 font-semibold text-fg-primary">Message Requests</span>
          <button className="flex size-7 items-center justify-center rounded-full transition-colors hover:bg-bg-selection-container-hover">
            <Search className="size-4 text-fg-secondary" />
          </button>
        </div>
      </div>
      {/* eslint-disable-next-line formatjs/no-literal-string-in-jsx */}
      <div className="px-4 pt-3 pb-2 text-center text-sm leading-[18px] text-fg-secondary">
        Message requests from people who aren&apos;t in your contact list appear here
      </div>
      <div className="flex-1 overflow-y-auto">
        {requests.map(req => (
          <RequestItem
            key={req.requestId}
            request={req}
            disabled={disabled}
            onAccept={() => onAccept(req)}
            onDecline={() => onDecline(req)}
          />
        ))}
      </div>
    </>
  );
};

type RequestItemProps = {
  request: P2PChatRequest;
  disabled: boolean;
  onAccept: VoidFunction;
  onDecline: VoidFunction;
};

const RequestItem = ({ request, disabled, onAccept, onDecline }: RequestItemProps) => {
  const name = request.peerUsername ?? request.peerId.slice(0, 12) + '...';

  return (
    <div className="relative flex w-full items-start gap-3 p-3 after:absolute after:right-3 after:bottom-0 after:left-22 after:h-px after:bg-border-divider">
      <Avatar name={name} size="chat-list" />
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
        <div className="flex w-full items-end gap-2">
          <span className="min-w-0 flex-1 truncate text-base leading-6 font-semibold text-fg-primary">{name}</span>
          <span className="shrink-0 text-sm leading-5 font-medium text-fg-tertiary">
            {new Date(request.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
          </span>
        </div>
        <div className="flex w-full items-center gap-2">
          {/* eslint-disable-next-line formatjs/no-literal-string-in-jsx */}
          <span className="min-w-0 flex-1 truncate text-sm leading-[18px] text-fg-secondary">Message Request</span>
          {/* eslint-disable-next-line formatjs/no-literal-string-in-jsx */}
          <Button variant="secondary" size="sm" disabled={disabled} onClick={onDecline}>
            Decline
          </Button>
          <div data-testid={TEST_IDS.chatRequestAcceptButton}>
            {/* eslint-disable-next-line formatjs/no-literal-string-in-jsx */}
            <Button size="sm" disabled={disabled} onClick={onAccept}>
              Accept
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

type OutgoingRequestItemProps = {
  request: P2PChatRequest;
  selected: boolean;
  onClick: VoidFunction;
};

const OutgoingRequestItem = ({ request, selected, onClick }: OutgoingRequestItemProps) => {
  const name = request.peerUsername ?? `${request.peerId.slice(0, 12)}...`;
  const time = new Date(request.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

  return (
    <div
      className={cnTw(
        'relative flex h-22 w-full cursor-pointer items-start gap-3 p-3 transition-colors after:absolute after:right-3 after:bottom-0 after:left-22 after:h-px after:bg-border-divider',
        selected ? 'bg-bg-selection-container-active' : 'hover:bg-bg-selection-container-hover',
      )}
      onClick={onClick}
    >
      <Avatar name={name} size="chat-list" />
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
        <div className="flex w-full items-end gap-2">
          <span className="max-w-full min-w-0 truncate text-base leading-6 font-semibold text-fg-primary">{name}</span>
          <Timer className="size-4 shrink-0 text-fg-tertiary" />
          <span className="ml-auto shrink-0 text-sm leading-5 font-medium text-fg-tertiary">{time}</span>
        </div>
        <span className="min-w-0 truncate text-sm leading-[18px] text-fg-secondary">{request.welcomeMessage ?? ''}</span>
      </div>
    </div>
  );
};

const OutgoingPendingRoom = ({ request, onRemove }: { request: P2PChatRequest; onRemove: VoidFunction }) => {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const name = request.peerUsername ?? `${request.peerId.slice(0, 12)}...`;

  useEffect(() => {
    inputRef.current?.focus();
  }, [request.peerId]);

  return (
    <div className="flex min-w-111 flex-1 flex-col overflow-hidden rounded-xl border border-border-primary bg-bg-surface-container">
      <div className="h-14 shrink-0 border-b border-border-primary">
        <div className="flex h-full items-center gap-2 py-2 pr-0 pl-4">
          <Avatar name={name} size="chat-header" />
          <div className="flex min-w-0 flex-1 items-center gap-2 pr-4">
            <div className="flex min-w-0 flex-1 flex-col items-start justify-center">
              <span className="w-full min-w-0 truncate text-base leading-6 font-semibold text-fg-primary">{name}</span>
              {/* eslint-disable-next-line formatjs/no-literal-string-in-jsx */}
              <span className="w-full truncate text-sm leading-[18px] text-fg-secondary">last seen recently</span>
            </div>
            <div className="flex shrink-0 items-center">
              <DropdownMenu>
                <DropdownMenu.Trigger asChild>
                  <Button variant="ghost" size="icon-sm">
                    <Ellipsis strokeWidth={1.75} className="size-5" />
                  </Button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Content align="end">
                  <DropdownMenu.Item variant="destructive" onClick={onRemove}>
                    <Trash2 className="mr-2 size-4" />
                    Remove chat
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-4 py-4">
        {request.welcomeMessage && (
          <div className="flex w-full flex-col items-end">
            <div className="max-w-[520px] rounded-2xl bg-bg-surface-container-inverted px-3 pt-2 pb-3">
              <p className="text-base leading-5 text-fg-primary-inverted">{request.welcomeMessage}</p>
            </div>
          </div>
        )}

        <div className="flex w-full items-center justify-center gap-2 px-4 py-2">
          <Timer className="size-4 shrink-0 text-fg-tertiary" />
          <span className="text-sm leading-[18px] text-fg-secondary">
            {/* eslint-disable-next-line formatjs/no-literal-string-in-jsx */}
            {`Chat request sent to ${name}. Waiting for them to accept.`}
          </span>
        </div>
      </div>

      <div className="shrink-0 border-t border-border-primary">
        <div className="flex flex-col gap-2 p-2">
          <MessageInput ref={inputRef} submitAction={async () => {}} />
        </div>
      </div>
    </div>
  );
};

// eslint-disable-next-line react/no-array-index-key
const skeleton = Array.from({ length: 8 }).map((_, index) => <ChatItemSkeleton key={index} />);
