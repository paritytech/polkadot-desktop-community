// @vitest-environment happy-dom

import { act, render, screen, waitFor } from '@testing-library/react';
import { type Observable, BehaviorSubject, of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { TEST_IDS } from '@/shared/test-ids';
import { TranslationProvider } from '@/shared/translation';
import { type ChatMessage, type ChatSession, type RoomFooter } from '@/domains/chat';

import { Room } from './Room';

function makeSession(footer?: Observable<RoomFooter>, overrides: Partial<ChatSession> = {}): ChatSession {
  // Tests are exempt from the no-`as` rule; we only need the observable surface.
  return {
    sessionId: 's1',
    roomId: 'room-1',
    name: of('Coinflip'),
    messages: of([]),
    lastMessage: of(null),
    unreadCount: of(0),
    participants: of([]),
    footer,
    sendMessage: async () => {},
    markAsRead: async () => {},
    deleteSession: async () => {},
    ...overrides,
  } as unknown as ChatSession;
}

function renderRoom(session: ChatSession) {
  return render(
    <TranslationProvider>
      <Room session={session} />
    </TranslationProvider>,
  );
}

const incomingText = (messageId: string, text: string, timestamp: number): ChatMessage => ({
  messageId,
  sessionId: 's1',
  peer: { type: 'p2p', accountId: '0xpeer', name: 'Alice' },
  timestamp,
  content: { type: 'text', text },
  status: { direction: 'incoming', state: 'new' },
});

describe('Room', () => {
  it('shows the composer for a session without a footer', async () => {
    renderRoom(makeSession());

    expect(await screen.findByTestId(TEST_IDS.chatMessageInput)).toBeInTheDocument();
  });

  it('renders neither the composer nor a card for a session whose footer is none', async () => {
    renderRoom(makeSession(of({ type: 'none' })));

    await screen.findByTestId(TEST_IDS.chatNoMessagesPlaceholder);
    expect(screen.queryByTestId(TEST_IDS.chatMessageInput)).toBeNull();
    expect(screen.queryByTestId(TEST_IDS.chatRoomFooterCard)).toBeNull();
  });

  it('draws the card instead of the composer for a session whose footer is a card', async () => {
    renderRoom(
      makeSession(of({ type: 'card', productId: 'coinflip.dot', messageType: 'scoreboard', payload: new Uint8Array([1]) })),
    );

    expect(await screen.findByTestId(TEST_IDS.chatRoomFooterCard)).toBeInTheDocument();
    expect(screen.queryByTestId(TEST_IDS.chatMessageInput)).toBeNull();
  });

  it('reads the chat only while the window is focused', async () => {
    const markAsRead = vi.fn(async () => {});
    const messages = new BehaviorSubject<ChatMessage[]>([incomingText('m-1', 'first', 1_700_000_000_000)]);
    renderRoom(makeSession(undefined, { messages, markAsRead }));

    await waitFor(() => expect(markAsRead).toHaveBeenCalled());

    act(() => {
      window.dispatchEvent(new Event('blur'));
    });
    markAsRead.mockClear();
    act(() => {
      messages.next([...messages.value, incomingText('m-2', 'second', 1_700_000_001_000)]);
    });
    await screen.findByText('second');
    expect(markAsRead).not.toHaveBeenCalled();

    act(() => {
      window.dispatchEvent(new Event('focus'));
    });
    await waitFor(() => expect(markAsRead).toHaveBeenCalledTimes(1));
  });

  it('reads the chat only while it is scrolled to the bottom', async () => {
    const markAsRead = vi.fn(async () => {});
    const messages = new BehaviorSubject<ChatMessage[]>([incomingText('m-1', 'first', 1_700_000_000_000)]);
    renderRoom(makeSession(undefined, { messages, markAsRead }));

    await waitFor(() => expect(markAsRead).toHaveBeenCalled());

    // happy-dom does no layout, so the scroll container gets a fixed geometry.
    const scroller = (await screen.findByText('first')).closest<HTMLElement>('.overflow-y-auto');
    if (!scroller) throw new Error('scroll container not found');
    Object.defineProperty(scroller, 'scrollHeight', { configurable: true, value: 2000 });
    Object.defineProperty(scroller, 'clientHeight', { configurable: true, value: 500 });
    const scrollTo = async (top: number) => {
      scroller.scrollTop = top;
      act(() => {
        scroller.dispatchEvent(new Event('scroll'));
      });
      await act(() => new Promise(resolve => requestAnimationFrame(() => resolve(undefined))));
    };

    await scrollTo(0);
    markAsRead.mockClear();
    act(() => {
      messages.next([...messages.value, incomingText('m-2', 'second', 1_700_000_001_000)]);
    });
    await screen.findByText('second');
    expect(markAsRead).not.toHaveBeenCalled();

    await scrollTo(1500);
    await waitFor(() => expect(markAsRead).toHaveBeenCalledTimes(1));
  });
});
