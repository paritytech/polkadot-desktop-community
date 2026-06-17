import { Button, DropdownMenu } from '@novasamatech/tr-ui';
import { Ban, Ellipsis, LogOut, Pencil, Reply, Search, ShieldOff, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useObservable } from 'react-rx';
import { of } from 'rxjs';

import { useTranslation } from '@/shared/translation';
import { type ChatMessage, type ChatSession, type MessageContent, uploadChatFile } from '@/domains/chat';
import { deriveLatestEdits, getMessagePreview, getPlainText } from '../helpers/message';
import { formatPeerName } from '../helpers/peerName';

import { type SelectedAttachment } from './AttachmentPreview';
import { Avatar } from './Avatar';
import { ChatSearchBar } from './ChatSearchBar';
import { ChatSearchResults } from './ChatSearchResults';
import { MessageFlow } from './MessageFlow';
import { MessageInput } from './MessageInput';

type ChatConversationViewProps = {
  session: ChatSession;
  onDeleted?: VoidFunction;
};

export const Room = ({ session, onDeleted }: ChatConversationViewProps) => {
  const { t } = useTranslation();

  const rawSessionName = useObservable(session.name, '');
  const sessionName = formatPeerName(rawSessionName, session.roomId);
  const blockedStream = useMemo(() => session.isBlocked ?? of(false), [session.isBlocked]);
  const isBlocked = useObservable(blockedStream, false);
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
            return uploadChatFile({ file: a.file, meta });
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
    <div className="flex min-w-111 flex-1 flex-col overflow-hidden rounded-xl border border-border-primary bg-bg-surface-container">
      <div className="h-14 shrink-0 border-b border-border-primary">
        <div className="flex h-full items-center gap-2 py-2 pr-0 pl-4">
          <Avatar name={sessionName} size="chat-header" />
          <div className="flex min-w-0 flex-1 items-center gap-2 pr-4">
            <div className="flex min-w-0 flex-1 flex-col items-start justify-center">
              <span className="w-full min-w-0 truncate text-base leading-6 font-semibold text-fg-primary">{sessionName}</span>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button variant="ghost" size="icon-sm" onClick={handleOpenSearch}>
                <Search strokeWidth={1.75} className="size-5" />
              </Button>
              <DropdownMenu>
                <DropdownMenu.Trigger asChild>
                  <Button variant="ghost" size="icon-sm">
                    <Ellipsis strokeWidth={1.75} className="size-5" />
                  </Button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Content align="end">
                  {canBlock && (
                    <DropdownMenu.Item onClick={handleToggleBlocked}>
                      {isBlocked ? <ShieldOff className="mr-2 size-4" /> : <Ban className="mr-2 size-4" />}
                      {isBlocked ? t('feature.chat.unblockUser') : t('feature.chat.blockUser')}
                    </DropdownMenu.Item>
                  )}
                  <DropdownMenu.Item variant="destructive" onClick={handleDelete}>
                    <LogOut className="mr-2 size-4" />
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
          onSelect={handleSelectResult}
        />
      ) : (
        <MessageFlow session={session} onReply={handleReply} onEdit={handleEdit} />
      )}

      <div className="shrink-0 border-t border-border-primary">
        {isBlocked ? (
          <div className="flex items-center justify-between gap-3 p-3">
            <p className="text-sm leading-[18px] text-fg-secondary">{t('feature.chat.blockedNotice', { name: sessionName })}</p>
            <Button variant="ghost" size="sm" onClick={handleToggleBlocked}>
              {t('feature.chat.unblock')}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2 p-2">
            {replyingTo && (
              <div className="flex w-full items-center gap-2">
                <div className="flex min-w-0 flex-1 items-start gap-0 rounded-2xl bg-bg-surface-nested pt-3 pr-3.5 pb-2 pl-3.5">
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex w-full items-center gap-1">
                      <Reply className="size-4 shrink-0 text-fg-primary" />
                      <span className="truncate text-sm leading-5 font-medium text-fg-primary">
                        {replyingTo.status.direction === 'outgoing'
                          ? t('feature.chat.replyToYourself')
                          : t('feature.chat.replyTo', { name: sessionName })}
                      </span>
                    </div>
                    <p className="w-full truncate text-sm leading-[18px] text-fg-secondary">{getMessagePreview(replyingTo)}</p>
                  </div>
                </div>
                <button
                  className="shrink-0 rounded p-1 transition-colors hover:bg-bg-selection-container-hover"
                  onClick={handleCancelReply}
                >
                  <X className="size-6 text-fg-secondary" />
                </button>
              </div>
            )}
            {editingMessage && (
              <div className="flex w-full items-center gap-2">
                <div className="flex min-w-0 flex-1 items-start gap-0 rounded-2xl bg-bg-surface-nested pt-3 pr-3.5 pb-2 pl-3.5">
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex w-full items-center gap-1">
                      <Pencil className="size-4 shrink-0 text-fg-primary" />
                      <span className="truncate text-sm leading-5 font-medium text-fg-primary">
                        {t('feature.chat.editingMessage')}
                      </span>
                    </div>
                    <p className="w-full truncate text-sm leading-[18px] text-fg-secondary">{editingMessage.text}</p>
                  </div>
                </div>
                <button
                  className="shrink-0 rounded p-1 transition-colors hover:bg-bg-selection-container-hover"
                  onClick={handleCancelEdit}
                >
                  <X className="size-6 text-fg-secondary" />
                </button>
              </div>
            )}
            {sendError && <p className="px-1 text-xs text-fg-error">{sendError}</p>}
            <MessageInput ref={inputRef} initialText={editingMessage?.text} submitAction={handleSendMessage} />
          </div>
        )}
      </div>
    </div>
  );
};
