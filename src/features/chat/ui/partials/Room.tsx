import { Button, DropdownMenu } from '@novasamatech/tr-ui';
import { Ban, Ellipsis, LogOut, Search, ShieldOff } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useObservable } from 'react-rx';
import { of } from 'rxjs';

import { Slot } from '@/shared/di';
import { TEST_IDS } from '@/shared/test-ids';
import { useTranslation } from '@/shared/translation';
import {
  type ChatMessage,
  type ChatSession,
  type MessageContent,
  type RoomFooter,
  fileTransferUseCase,
  useCurrentUserPeer,
} from '@/domains/chat';
import { useTruapiSession, useTruapiUserId } from '@/aggregates/truapi-runtime';
import { chatRoomBannerSlot, chatRoomHeaderActionsSlot } from '../../di';
import { chatService } from '../../service';
import { deriveLatestEdits, getMessagePreview, getPlainText } from '../helpers/message';

import { type SelectedAttachment } from './AttachmentPreview';
import { Avatar } from './Avatar';
import { ChatSearchBar } from './ChatSearchBar';
import { ChatSearchResults } from './ChatSearchResults';
import { MessageFlow } from './MessageFlow';
import { MessageInput } from './MessageInput';
import { RoomFooterCard } from './RoomFooterCard';

type ChatConversationViewProps = {
  session: ChatSession;
  // Set when opened from a global "Messages" hit: pre-fills in-room search and activates the matched result.
  initialSearch?: { query: string; messageId: string };
  onDeleted?: VoidFunction;
};

export const Room = ({ session, initialSearch, onDeleted }: ChatConversationViewProps) => {
  const { t } = useTranslation();

  const rawSessionName = useObservable(session.name, '');
  const sessionName = chatService.formatPeerName(rawSessionName, session.roomId);
  const userSession = useTruapiSession();
  const { data: currentUserPeer } = useCurrentUserPeer(
    useTruapiUserId(),
    userSession?.fullUsername ?? userSession?.liteUsername ?? '',
  );
  const blockedStream = useMemo(() => session.isBlocked ?? of(false), [session.isBlocked]);
  const isBlocked = useObservable(blockedStream, false);
  const footerStream = useMemo(() => session.footer ?? of<RoomFooter>({ type: 'text' }), [session.footer]);
  const footer = useObservable(footerStream, { type: 'text' });
  const acceptsText = footer.type === 'text';
  const canBlock = typeof session.setBlocked === 'function';

  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [editingMessage, setEditingMessage] = useState<{ messageId: string; text: string } | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [resultIndex, setResultIndex] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const messages = useObservable(session.messages, []);

  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return [];
    const latestEdits = deriveLatestEdits(messages);
    return messages
      .filter(m => m.content.type !== 'reacted' && m.content.type !== 'reactionRemoved' && m.content.type !== 'edit')
      .filter(m => {
        const text = (latestEdits.get(m.messageId)?.text ?? getPlainText(m.content)).toLowerCase();
        return text.length > 0 && text.includes(query);
      })
      .sort((a, b) => b.timestamp - a.timestamp);
  }, [messages, searchQuery]);

  useEffect(() => {
    setResultIndex(0);
  }, [searchQuery]);

  useEffect(() => {
    inputRef.current?.focus();
    setSearchOpen(false);
    setSearchQuery('');
  }, [session.sessionId]);

  // Runs after the session-change reset above, so it wins and leaves the search open.
  useEffect(() => {
    if (!initialSearch) return;
    setSearchOpen(true);
    setSearchQuery(initialSearch.query);
  }, [initialSearch]);

  // Activate the matched result only ONCE per jump: `searchResults` gets a fresh array reference on every
  // `session.messages` emission, so without this guard it would keep clobbering manual nav or a retyped query.
  const appliedJumpIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!initialSearch) {
      appliedJumpIdRef.current = null;

      return;
    }
    if (appliedJumpIdRef.current === initialSearch.messageId) return;
    const idx = searchResults.findIndex(m => m.messageId === initialSearch.messageId);
    if (idx >= 0) {
      setResultIndex(idx);
      appliedJumpIdRef.current = initialSearch.messageId;
    }
  }, [initialSearch, searchResults]);

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

  const handleOpenSearch = useCallback(() => {
    setSearchOpen(true);
  }, []);

  const handleCloseSearch = useCallback(() => {
    setSearchOpen(false);
    setSearchQuery('');
  }, []);

  const handlePrevResult = useCallback(() => {
    if (searchResults.length === 0) return;
    setResultIndex(i => (i - 1 + searchResults.length) % searchResults.length);
  }, [searchResults.length]);

  const handleNextResult = useCallback(() => {
    if (searchResults.length === 0) return;
    setResultIndex(i => (i + 1) % searchResults.length);
  }, [searchResults.length]);

  const handleSelectResult = useCallback(
    (message: ChatMessage) => {
      const idx = searchResults.findIndex(m => m.messageId === message.messageId);
      if (idx >= 0) setResultIndex(idx);
    },
    [searchResults],
  );

  const activeResultId = searchResults[resultIndex]?.messageId ?? null;
  const showResults = searchOpen && searchQuery.trim().length > 0;

  const handleReply = useCallback((message: ChatMessage) => {
    setEditingMessage(null);
    setReplyingTo(message);
    inputRef.current?.focus();
  }, []);

  const handleCancelReply = useCallback(() => {
    setReplyingTo(null);
  }, []);

  const handleEdit = useCallback((_message: ChatMessage, displayText: string) => {
    setReplyingTo(null);
    setEditingMessage({ messageId: _message.messageId, text: displayText });
    inputRef.current?.focus();
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingMessage(null);
  }, []);

  const handleDelete = useCallback(async () => {
    await session.deleteSession();
    onDeleted?.();
  }, [session, onDeleted]);

  const handleToggleBlocked = useCallback(async () => {
    if (!session.setBlocked) return;
    await session.setBlocked(!isBlocked);
  }, [session, isBlocked]);

  const handleSendMessage = useCallback(
    async (messageText: string, attachments?: SelectedAttachment[]) => {
      const trimmed = messageText.trim();
      const hasAttachments = attachments && attachments.length > 0;
      if (trimmed.length === 0 && !hasAttachments) return;

      setSendError(null);

      if (editingMessage) {
        setEditingMessage(null);

        const message: MessageContent = {
          type: 'edit',
          messageId: editingMessage.messageId,
          newContent: { type: 'richText', text: trimmed },
        };

        try {
          await session.sendMessage(message);
        } catch (e) {
          console.error('[chat] Failed to send edit:', e);
          setSendError(e instanceof Error ? e.message : 'Failed to send edit');
          // Rethrow so MessageInput keeps the draft (it clears only on success).
          throw e;
        }

        return;
      }

      setReplyingTo(null);

      let message: MessageContent;

      if (hasAttachments) {
        const uploadedAttachments = await Promise.all(
          attachments.map(a => {
            const meta = a.file.type.startsWith('image/')
              ? {
                  type: 'image' as const,
                  mimeType: a.file.type,
                  fileSize: a.file.size,
                  width: a.width ?? 0,
                  height: a.height ?? 0,
                }
              : a.file.type.startsWith('video/')
                ? { type: 'video' as const, mimeType: a.file.type, fileSize: a.file.size, duration: 0 }
                : { type: 'general' as const, mimeType: a.file.type || 'application/octet-stream', fileSize: a.file.size };
            return fileTransferUseCase.uploadChatFile({ file: a.file, meta });
          }),
        );

        message = {
          type: 'richText',
          text: trimmed.length > 0 ? trimmed : undefined,
          attachments: uploadedAttachments,
        };
      } else {
        message = { type: 'text', text: trimmed };
      }

      if (replyingTo && !hasAttachments) {
        message = {
          type: 'reply',
          messageId: replyingTo.messageId,
          content: message,
        };
      }

      try {
        await session.sendMessage(message);
      } catch (e) {
        console.error('[chat] Failed to send message:', e);
        setSendError(e instanceof Error ? e.message : 'Failed to send message');
        // Rethrow so MessageInput keeps the draft (it clears only on success) —
        // a MessageTooLarge rejection already deleted the optimistic row, so a
        // cleared input would lose the user's text entirely.
        throw e;
      }
    },
    [session, replyingTo, editingMessage],
  );

  return (
    <div className="flex min-w-111 flex-1 flex-col overflow-hidden rounded-xl border border-stroke-primary bg-bg-surface-container">
      <Slot id={chatRoomBannerSlot} props={{ session }} />
      <div className="h-14 shrink-0 border-b border-stroke-primary">
        <div className="flex h-full items-center gap-2 py-2 ps-4 pe-0">
          <Avatar name={sessionName} size="chat-header" />
          <div className="flex min-w-0 flex-1 items-center gap-2 pe-4">
            <div className="flex min-w-0 flex-1 flex-col items-start justify-center">
              <span className="w-full min-w-0 truncate text-base leading-6 font-semibold text-fg-primary">{sessionName}</span>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Slot id={chatRoomHeaderActionsSlot} props={{ session }} />
              <Button variant="ghost" size="icon-sm" onClick={handleOpenSearch}>
                <Search strokeWidth={1.75} className="size-5" />
              </Button>
              <DropdownMenu>
                <DropdownMenu.Trigger asChild>
                  <Button data-testid={TEST_IDS.chatRoomHeaderMenuTrigger} variant="ghost" size="icon-sm">
                    <Ellipsis strokeWidth={1.75} className="size-5" />
                  </Button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Content align="end">
                  {canBlock && (
                    <DropdownMenu.Item onClick={handleToggleBlocked}>
                      {isBlocked ? <ShieldOff className="me-2 size-4" /> : <Ban className="me-2 size-4" />}
                      {isBlocked ? t('feature.chat.unblockUser') : t('feature.chat.blockUser')}
                    </DropdownMenu.Item>
                  )}
                  <DropdownMenu.Item data-testid={TEST_IDS.chatRoomHeaderMenuDelete} variant="destructive" onClick={handleDelete}>
                    <LogOut className="me-2 size-4" />
                    {t('feature.chat.leaveChat')}
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>

      {searchOpen && (
        <ChatSearchBar
          query={searchQuery}
          inputRef={searchInputRef}
          resultCount={searchResults.length}
          resultIndex={resultIndex}
          onQueryChange={setSearchQuery}
          onPrev={handlePrevResult}
          onNext={handleNextResult}
          onClose={handleCloseSearch}
        />
      )}

      {showResults ? (
        <ChatSearchResults
          query={searchQuery}
          results={searchResults}
          activeMessageId={activeResultId}
          peerName={sessionName}
          currentUserName={currentUserPeer?.name ?? ''}
          onSelect={handleSelectResult}
        />
      ) : (
        <MessageFlow
          session={session}
          onReply={acceptsText ? handleReply : undefined}
          onEdit={acceptsText ? handleEdit : undefined}
        />
      )}

      {footer.type === 'none' ? null : (
        <div className="shrink-0 border-t border-stroke-primary">
          {footer.type === 'card' ? (
            <RoomFooterCard roomId={session.roomId} footer={footer} />
          ) : isBlocked ? (
            <div className="flex items-center justify-between gap-3 p-3">
              <p className="text-sm leading-4.5 text-fg-secondary">{t('feature.chat.blockedNotice', { name: sessionName })}</p>
              <Button variant="ghost" size="sm" onClick={handleToggleBlocked}>
                {t('feature.chat.unblock')}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-2 p-2">
              {sendError && <p className="px-1 text-xs text-fg-error">{sendError}</p>}
              <MessageInput
                ref={inputRef}
                initialText={editingMessage?.text}
                preview={
                  replyingTo
                    ? {
                        testId: TEST_IDS.chatReplyComposer,
                        title:
                          replyingTo.status.direction === 'outgoing'
                            ? t('feature.chat.replyToYourself')
                            : t('feature.chat.replyTo', { name: sessionName }),
                        text: getMessagePreview(replyingTo),
                        onClose: handleCancelReply,
                      }
                    : editingMessage
                      ? {
                          testId: TEST_IDS.chatEditComposer,
                          title: t('feature.chat.editingMessage'),
                          text: editingMessage.text,
                          onClose: handleCancelEdit,
                        }
                      : undefined
                }
                submitAction={handleSendMessage}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
