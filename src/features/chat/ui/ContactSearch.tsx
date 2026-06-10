import { Button } from '@novasamatech/tr-ui';
import { Check, ChevronLeft, ChevronRight, Loader2, Search, Send, X } from 'lucide-react';
import { type ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';

import { TEST_IDS } from '@/shared/test-ids';
import { cnTw } from '@/shared/utils';
import { useContactSearch, useP2PChatManager, useP2PSessions, useSendChatRequest } from '@/domains/chat';

import { Avatar } from './partials/Avatar';

type Props = {
  onClose: VoidFunction;
  onRequestSent?: (peerId: string) => void;
};

type SelectedPeer = {
  accountId: string;
  username: string;
};

export const ContactSearch = ({ onClose, onRequestSent }: Props) => {
  const { search, results, pending, searchError } = useContactSearch();
  const sendChatRequest = useSendChatRequest();
  const manager = useP2PChatManager();
  const { data: p2pSessions } = useP2PSessions();
  const [query, setQuery] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPeer, setSelectedPeer] = useState<SelectedPeer | null>(null);
  const [welcomeText, setWelcomeText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const welcomeRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (selectedPeer) {
      welcomeRef.current?.focus();
    }
  }, [selectedPeer]);

  useEffect(() => {
    const handleMouseDown = (e: globalThis.MouseEvent) => {
      if (containerRef.current && e.target instanceof Node && !containerRef.current.contains(e.target)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [onClose]);

  const connectedIds = useMemo(() => new Set(p2pSessions.map(s => s.sessionId)), [p2pSessions]);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    setError(null);
    search(value);
  };

  const handleClear = () => {
    setQuery('');
    setError(null);
    search('');
    inputRef.current?.focus();
  };

  const handleSelect = (accountId: string, username: string) => {
    setSelectedPeer({ accountId, username });
    setWelcomeText('');
    setError(null);
  };

  const handleBack = () => {
    setSelectedPeer(null);
    setWelcomeText('');
    setError(null);
  };

  const handleSendRequest = async () => {
    if (sending || !selectedPeer) return;
    setSending(true);
    setError(null);

    try {
      await sendChatRequest(selectedPeer.accountId, selectedPeer.username, welcomeText.trim() || undefined);
      onRequestSent?.(selectedPeer.accountId);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send request');
    } finally {
      setSending(false);
    }
  };

  const hasResults = !pending && results.length > 0;
  const hasQuery = query.length > 0;

  if (selectedPeer) {
    return (
      <div ref={containerRef} className="flex flex-1 flex-col overflow-hidden">
        <div className="shrink-0 px-2 py-2">
          <button
            className="flex items-center gap-1 rounded-md px-2 py-1 text-sm text-fg-secondary transition-colors hover:text-fg-primary"
            onClick={handleBack}
          >
            <ChevronLeft className="size-4" />
            {/* eslint-disable-next-line formatjs/no-literal-string-in-jsx -- nav label */}
            <span>Back</span>
          </button>
        </div>

        <div className="flex flex-col gap-4 px-4 py-2">
          <div className="flex items-center gap-3">
            <Avatar name={selectedPeer.username} size="chat-header" />
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-base leading-6 font-semibold text-fg-primary">{selectedPeer.username}</span>
              <span className="truncate text-sm leading-[18px] text-fg-secondary">
                {`${selectedPeer.accountId.slice(0, 8)}...${selectedPeer.accountId.slice(-6)}`}
              </span>
            </div>
          </div>

          <input
            ref={welcomeRef}
            type="text"
            data-testid={TEST_IDS.contactWelcomeInput}
            value={welcomeText}
            // eslint-disable-next-line formatjs/no-literal-string-in-jsx
            placeholder="Say hello... (optional)"
            className="h-10 w-full rounded-xl bg-bg-action-secondary px-3 text-sm leading-5 text-fg-primary outline-none placeholder:text-fg-tertiary focus:bg-bg-action-secondary-hover"
            onKeyDown={e => {
              if (e.key === 'Enter') handleSendRequest();
            }}
            onChange={e => setWelcomeText(e.target.value)}
          />

          {error && <p className="text-xs text-fg-error">{error}</p>}

          <div data-testid={TEST_IDS.contactSendRequestButton}>
            <Button fullWidth disabled={sending || !manager} onClick={handleSendRequest}>
              {sending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Send className="mr-2 size-4" />}
              {sending ? 'Sending...' : 'Send Request'}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex flex-1 flex-col overflow-hidden">
      <div className="shrink-0 px-2 py-2">
        <div className="relative flex items-center">
          <Search className="pointer-events-none absolute left-3 size-4 text-fg-tertiary" />
          <input
            ref={inputRef}
            type="text"
            data-testid={TEST_IDS.contactSearchInput}
            value={query}
            // eslint-disable-next-line formatjs/no-literal-string-in-jsx
            placeholder="Search by username"
            className="h-10 w-full rounded-full bg-bg-action-secondary pr-9 pl-9 text-sm leading-5 text-fg-primary outline-none placeholder:text-fg-tertiary focus:bg-bg-action-secondary-hover"
            onChange={handleChange}
          />
          {hasQuery && (
            <button
              className="absolute right-2 flex size-6 items-center justify-center rounded-full text-fg-tertiary transition-colors hover:text-fg-secondary"
              onClick={handleClear}
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      </div>

      {hasQuery && (
        <div className="flex flex-1 flex-col overflow-y-auto">
          <div className="shrink-0 px-4 py-2">
            {/* eslint-disable-next-line formatjs/no-literal-string-in-jsx */}
            <span className="text-sm leading-5 font-medium text-fg-secondary">Results</span>
          </div>

          {error && <p className="shrink-0 px-4 pb-2 text-xs text-fg-error">{error}</p>}

          {pending && (
            <div className="flex shrink-0 items-center justify-center py-4">
              <Loader2 className="size-4 animate-spin text-fg-tertiary" />
            </div>
          )}

          {hasResults &&
            results.map(result => (
              <ContactResultItem
                key={result.candidateAccountId}
                username={result.username}
                isConnected={connectedIds.has(result.candidateAccountId)}
                disabled={!manager}
                onSelect={() => handleSelect(result.candidateAccountId, result.username)}
              />
            ))}

          {!pending && hasQuery && results.length === 0 && (
            <p className={cnTw('shrink-0 px-4 py-4 text-center text-sm', searchError ? 'text-fg-error' : 'text-fg-tertiary')}>
              {/* eslint-disable-next-line formatjs/no-literal-string-in-jsx */}
              {searchError ? searchError : <>No results found for &quot;{query}&quot;</>}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

type ContactResultItemProps = {
  username: string;
  isConnected: boolean;
  disabled: boolean;
  onSelect: VoidFunction;
};

const ContactResultItem = ({ username, isConnected, disabled, onSelect }: ContactResultItemProps) => {
  return (
    <button
      data-testid={TEST_IDS.contactResultItem}
      className="flex w-full shrink-0 items-center gap-3 p-3 text-left transition-colors hover:bg-bg-selection-container-hover disabled:opacity-50"
      disabled={disabled || isConnected}
      onClick={onSelect}
    >
      <Avatar name={username} size="chat-list" />
      <div className="flex min-w-0 flex-1 items-center justify-between">
        <span className="min-w-0 flex-1 truncate text-base leading-6 font-semibold text-fg-primary">{username}</span>
        {isConnected ? (
          <Check className="size-4 shrink-0 text-fg-tertiary" />
        ) : (
          <ChevronRight className="size-4 shrink-0 text-fg-tertiary" />
        )}
      </div>
    </button>
  );
};
