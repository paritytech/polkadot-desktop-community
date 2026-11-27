import { useNavigate } from '@tanstack/react-router';
import { type PropsWithChildren, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useObservable } from 'react-rx';
import { of } from 'rxjs';

import Maximize2Icon from '@/shared/assets/images/icons/maximize-2.svg?jsx';
import MessageCircleIcon from '@/shared/assets/images/icons/message-circle.svg?jsx';
import MessagesSquareIcon from '@/shared/assets/images/icons/messages-square.svg?jsx';
import { AppIcon, Avatar, DismissOverlay, EmptyState, IconButton, PaneHeader, Popover } from '@/shared/components';
import { useCloseOnWindowLeave } from '@/shared/hooks';
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
import { ChatItem } from './partials/ChatItem';
import { MessageFlow } from './partials/MessageFlow';
import { MessageInput } from './partials/MessageInput';
import { NewRequestsItem } from './partials/NewRequestsItem';
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

  useCloseOnWindowLeave(open, () => onOpenChange(false));

  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <DismissOverlay open={open} testId={TEST_IDS.dismissOverlay} onDismiss={() => onOpenChange(false)} />
      <Popover.Trigger asChild>{children}</Popover.Trigger>
      <Popover.Content sideOffset={8} align="end" alignOffset={8}>
        <div data-testid={TEST_IDS.quickChatPopover} className="flex h-136 w-89 flex-col overflow-hidden">
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
                <div className="shrink-0 border-t border-stroke-primary p-2">
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
    </Popover.Root>
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
    <PaneHeader
      variant="list"
      icon={
        session ? (
          <Avatar label={sessionName} size="24" />
        ) : (
          <AppIcon size="24" alt="">
            <MessageCircleIcon className="size-4" />
          </AppIcon>
        )
      }
      actions={
        <IconButton data-testid={TEST_IDS.quickChatExpandButton} label={t('feature.chat.viewMore')} onClick={() => onExpand()}>
          <Maximize2Icon />
        </IconButton>
      }
      onBack={onBack}
    >
      {session ? sessionName : t('feature.chat.quickChat')}
    </PaneHeader>
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

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <SyncStatusBanner />
        {chatListEntries.length === 0 ? (
          <EmptyState
            icon={<MessagesSquareIcon />}
            title={t('feature.chat.noChatsYet')}
            description={t('feature.chat.yourChatsWillAppear')}
          />
        ) : (
          chatListEntries.map(entry => {
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

            return <ChatItem key={entry.session.sessionId} session={entry.session} onClick={() => onSelect(entry.session)} />;
          })
        )}
      </div>
    </div>
  );
};
