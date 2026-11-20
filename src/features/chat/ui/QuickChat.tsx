import { Popover } from '@novasamatech/tr-ui';
import { useNavigate } from '@tanstack/react-router';
import { ArrowLeft, MessagesSquare } from 'lucide-react';
import { type PropsWithChildren, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useObservable } from 'react-rx';
import { of } from 'rxjs';

import ChatBubbleOvalLeftIcon from '@/shared/assets/images/header/chat-bubble-oval-left.svg?jsx';
import MaximizeIcon from '@/shared/assets/images/header/maximize.svg?jsx';
import { DismissOverlay } from '@/shared/components';
import { TEST_IDS } from '@/shared/test-ids';
import { useTranslation } from '@/shared/translation';
import { type ChatSession, type RoomFooter, useProductSessions } from '@/domains/chat';
import { browserTabs } from '@/aggregates/browser-tabs';
import { useP2PChatRequests, useP2PSessions } from '@/aggregates/p2p-chat';
import { useTruapiUserId } from '@/aggregates/truapi-runtime';
import { type ChatListEntry, useSortedChatList } from '../hooks/useSortedChatList';
import { chatService } from '../service';
import { CHAT } from '../tabs';

import { SyncStatusBanner } from './SyncStatusBanner';
import { Avatar } from './partials/Avatar';
import { ChatItem } from './partials/ChatItem';
import { MessageFlow } from './partials/MessageFlow';
import { MessageInput } from './partials/MessageInput';
import { NewRequestsItem } from './partials/NewRequestsItem';
import { NoData } from './partials/NoData';
import { OutgoingRequestItem } from './partials/OutgoingRequestItem';
import { RoomFooterCard } from './partials/RoomFooterCard';

type QuickChatProps = PropsWithChildren<{
  open: boolean;
  onOpenChange(open: boolean): void;
}>;

export const QuickChat = memo(({ open, onOpenChange, children }: QuickChatProps) => {
  const navigate = useNavigate();
  const userId = useTruapiUserId();
  const { data: productSessions } = useProductSessions(userId);
  const { data: p2pSessions } = useP2PSessions();
  const { data: pendingRequests, outgoing: outgoingRequests } = useP2PChatRequests();
  const [selectedSession, setSelectedSession] = useState<ChatSession | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  const sessions = useMemo(
    () => chatService.excludePendingSessions([...productSessions, ...p2pSessions], outgoingRequests, pendingRequests),
    [productSessions, p2pSessions, outgoingRequests, pendingRequests],
  );
  const chatListEntries = useSortedChatList(sessions, outgoingRequests, pendingRequests);
  const requesterNames = useMemo(() => chatService.formatRequesterNames(pendingRequests), [pendingRequests]);

  const footerStream = useMemo(() => selectedSession?.footer ?? of<RoomFooter>({ type: 'text' }), [selectedSession]);
  const footer = useObservable(footerStream, { type: 'text' });

  const inputRef = useRef<HTMLTextAreaElement>(null);

  const showList = !selectedSession;

  const handleExpandToFullscreen = useCallback(
    (sessionId?: string) => {
      onOpenChange(false);
      browserTabs.addTab({ id: CHAT, type: CHAT, deeplink: '' }, { persistable: true });
      browserTabs.selectTab(CHAT);
      if (sessionId) {
        void navigate({ to: '/chat/{-$chatId}', params: { chatId: sessionId } });
      } else {
        void navigate({ to: '/chat/{-$chatId}' });
      }
    },
    [navigate, onOpenChange],
  );

  const handleBackToList = useCallback(() => {
    setSelectedSession(null);
    setSendError(null);
  }, []);

  const handleSelectSession = useCallback((session: ChatSession) => {
    setSelectedSession(session);
    setSendError(null);
  }, []);

  const handleSendMessage = useCallback(
    async (text: string) => {
      if (!selectedSession) return;

      setSendError(null);
      try {
        await selectedSession.sendMessage({
          type: 'text',
          text,
        });
      } catch (e) {
        console.error('[chat] Failed to send message:', e);
        setSendError(e instanceof Error ? e.message : 'Failed to send message');
        // Rethrow so MessageInput keeps the draft (it clears only on success).
        throw e;
      }
    },
    [selectedSession],
  );

  useEffect(() => {
    if (open) return;
    setSelectedSession(null);
    setSendError(null);
  }, [open]);

  // Radix's non-modal outside-click is document `pointerdown`. That never fires
  // for clicks inside a product iframe, nor for clicks on the toolbar's
  // -webkit-app-region: drag area (the OS steals the event for window drag).
  // The toolbar drag area is covered by <DismissOverlay/> below; window blur and
  // resize still close on iframe focus-steal — same defensive pattern as UserInfoPopover.
  useEffect(() => {
    if (!open) return;
    const close = () => onOpenChange(false);
    window.addEventListener('blur', close);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('blur', close);
      window.removeEventListener('resize', close);
    };
  }, [open, onOpenChange]);

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <DismissOverlay open={open} testId={TEST_IDS.dismissOverlay} onDismiss={() => onOpenChange(false)} />
      <Popover.Trigger asChild>{children}</Popover.Trigger>
      <Popover.Content variant="flush" sideOffset={8} align="end" alignOffset={8}>
        <div
          data-testid={TEST_IDS.quickChatPopover}
          className="flex h-137.5 w-89 flex-col overflow-hidden rounded-xl border border-stroke-primary bg-bg-surface-container shadow-lg"
        >
          {showList ? (
            <ChatList
              chatListEntries={chatListEntries}
              requesterNames={requesterNames}
              onSelect={handleSelectSession}
              onExpand={handleExpandToFullscreen}
            />
          ) : (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <QuickChatPageHeader
                session={selectedSession}
                onBack={handleBackToList}
                onExpand={() => handleExpandToFullscreen(selectedSession?.sessionId)}
              />

              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <MessageFlow session={selectedSession} />
              </div>

              {selectedSession && footer.type !== 'none' ? (
                <div className="shrink-0 border-t border-stroke-primary p-1">
                  {footer.type === 'card' ? (
                    <RoomFooterCard roomId={selectedSession.roomId} footer={footer} />
                  ) : (
                    <>
                      {sendError && <p className="px-1 pb-1 text-xs text-fg-error">{sendError}</p>}
                      <MessageInput ref={inputRef} submitAction={handleSendMessage} />
                    </>
                  )}
                </div>
              ) : null}
            </div>
          )}
        </div>
      </Popover.Content>
    </Popover>
  );
});

type QuickChatPageHeaderProps = {
  session?: ChatSession | null;
  onBack?: VoidFunction;
  onExpand: VoidFunction;
};

const QuickChatPageHeader = ({ session, onBack, onExpand }: QuickChatPageHeaderProps) => {
  const { t } = useTranslation();
  const rawSessionName = useObservable(session?.name ?? of(''), '');
  const sessionName = session ? chatService.formatPeerName(rawSessionName, session.roomId) : '';

  return (
    <div className="flex h-10 shrink-0 items-center gap-2 bg-bg-surface-container p-2">
      {onBack ? (
        <>
          <button
            className="flex size-7 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-bg-selection-container-hover"
            aria-label={t('common.action.back')}
            onClick={onBack}
          >
            <ArrowLeft className="size-4 text-fg-secondary" />
          </button>
          <Avatar name={sessionName} size="tiny" />
          <span className="min-w-0 flex-1 truncate text-sm leading-5 font-semibold text-fg-primary">{sessionName}</span>
        </>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-bg-illustration-dark">
            <ChatBubbleOvalLeftIcon className="size-4 text-fg-primary-inverted" aria-hidden />
          </div>
          <span className="truncate text-sm leading-5 font-semibold text-fg-primary">{t('feature.chat.quickChat')}</span>
        </div>
      )}
      <button
        data-testid={TEST_IDS.quickChatExpandButton}
        className="flex size-7 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-bg-selection-container-hover"
        aria-label={t('feature.chat.viewMore')}
        onClick={() => onExpand()}
      >
        <MaximizeIcon className="size-4 text-fg-secondary" aria-hidden />
      </button>
    </div>
  );
};

const ChatList = ({
  chatListEntries,
  requesterNames,
  onSelect,
  onExpand,
}: {
  chatListEntries: ChatListEntry[];
  requesterNames: string;
  onSelect: (session: ChatSession) => void;
  onExpand(peerId?: string): void;
}) => {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <QuickChatPageHeader onExpand={onExpand} />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <SyncStatusBanner />
        {chatListEntries.length === 0 ? (
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
                  onClick={() => onExpand()}
                />
              );
            }
            if (entry.kind === 'outgoing') {
              return (
                <OutgoingRequestItem
                  key={entry.request.requestId}
                  request={entry.request}
                  selected={false}
                  onClick={() => onExpand(entry.request.peerId)}
                />
              );
            }

            return (
              <ChatItem
                key={entry.session.sessionId}
                session={entry.session}
                isLast={index === chatListEntries.length - 1}
                onClick={() => onSelect(entry.session)}
              />
            );
          })
        )}
      </div>
    </div>
  );
};
