import { Popover } from '@novasamatech/tr-ui';
import { useNavigate } from '@tanstack/react-router';
import { ArrowLeft, MessageSquare, SquareDashed } from 'lucide-react';
import { type PropsWithChildren, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useObservable } from 'react-rx';

import { TEST_IDS } from '@/shared/test-ids';
import { useTranslation } from '@/shared/translation';
import { type ChatSession, useP2PSessions, useProductSessions } from '@/domains/chat';
import { browserTabs } from '@/aggregates/browser-tabs';
import { CHAT } from '../tabs';

import { Avatar } from './partials/Avatar';
import { MessageFlow } from './partials/MessageFlow';
import { MessageInput } from './partials/MessageInput';
import { RoomList } from './partials/RoomList';

type QuickChatProps = PropsWithChildren<{
  open: boolean;
  onOpenChange(open: boolean): void;
}>;

export const QuickChat = memo(({ open, onOpenChange, children }: QuickChatProps) => {
  const { data: productSessions } = useProductSessions();
  const { data: p2pSessions } = useP2PSessions();
  const [selectedSession, setSelectedSession] = useState<ChatSession | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  const sessions = useMemo(() => [...productSessions, ...p2pSessions], [productSessions, p2pSessions]);

  const inputRef = useRef<HTMLTextAreaElement>(null);

  const showList = !selectedSession;

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

  // Radix's non-modal outside-click is document `pointerdown`. That never fires
  // for clicks inside a product iframe, nor for clicks on the toolbar's
  // -webkit-app-region: drag area (the OS steals the event for window drag).
  // Close on window blur and resize so the popover still dismisses in those
  // cases — same defensive pattern as UserInfoPopover.
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
      <Popover.Trigger asChild>{children}</Popover.Trigger>
      <Popover.Content>
        <div data-testid={TEST_IDS.quickChatPopover} className="flex h-105 min-h-0 w-77.5 flex-col overflow-hidden">
          {showList ? (
            <ChatList sessions={sessions} onSelect={handleSelectSession} onClose={() => onOpenChange(false)} />
          ) : (
            <>
              <RoomHeader session={selectedSession} onBack={handleBackToList} />

              <MessageFlow session={selectedSession} onReply={() => {}} onEdit={() => {}} />

              {selectedSession && (
                <div className="shrink-0 p-2">
                  {sendError && <p className="px-1 pb-1 text-xs text-fg-error">{sendError}</p>}
                  <MessageInput ref={inputRef} submitAction={handleSendMessage} />
                </div>
              )}
            </>
          )}
        </div>
      </Popover.Content>
    </Popover>
  );
});

type RoomHeaderProps = {
  session: ChatSession;
  onBack: VoidFunction;
};

const RoomHeader = ({ session, onBack }: RoomHeaderProps) => {
  const sessionName = useObservable(session.name, '');

  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-border-primary bg-bg-surface-container p-2">
      <button
        className="flex size-8 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-bg-selection-container-hover"
        onClick={onBack}
      >
        <ArrowLeft className="size-4 text-fg-secondary" />
      </button>
      <Avatar name={sessionName} size="chat-header" />
      <span className="min-w-0 flex-1 truncate text-base leading-6 font-semibold text-fg-primary">{sessionName}</span>
    </div>
  );
};

const ChatList = ({
  sessions,
  onSelect,
  onClose,
}: {
  sessions: ChatSession[];
  onSelect: (session: ChatSession) => void;
  onClose: VoidFunction;
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleFullscreenClick = () => {
    onClose();
    browserTabs.addTab({ id: CHAT, type: CHAT, deeplink: '' }, { persistable: true });
    browserTabs.selectTab(CHAT);
    void navigate({ to: '/chat/{-$chatId}' });
  };

  return (
    <>
      <div className="flex shrink-0 items-center justify-between border-b border-border-primary bg-bg-surface-container p-2">
        <div className="flex items-center gap-2">
          <div className="flex size-6 items-center justify-center rounded-md bg-bg-illustration-dark">
            <MessageSquare className="size-3.5 text-fg-primary-inverted" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm leading-5 font-semibold text-fg-primary">{t('feature.chat.quickChat')}</span>
            <span className="text-xs leading-4 font-semibold tracking-[1px] text-fg-tertiary uppercase">
              {t('feature.chat.category')}
            </span>
          </div>
        </div>
        <button
          className="flex size-8 items-center justify-center rounded-full transition-colors hover:bg-bg-selection-container-hover"
          onClick={handleFullscreenClick}
        >
          <SquareDashed className="size-4 text-fg-secondary" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <RoomList sessions={sessions} selected={null} onSelect={onSelect} />
      </div>

      <div className="shrink-0 border-t border-border-primary">
        <button
          data-testid={TEST_IDS.quickChatViewMoreButton}
          className="flex h-10 w-full items-center justify-center px-4 text-sm leading-5 font-medium text-fg-primary transition-colors hover:text-fg-secondary"
          onClick={handleFullscreenClick}
        >
          {t('feature.chat.viewMore')}
        </button>
      </div>
    </>
  );
};
