// @vitest-environment happy-dom

import { render, screen } from '@testing-library/react';
import { type Observable, of } from 'rxjs';
import { describe, expect, it } from 'vitest';

import { TEST_IDS } from '@/shared/test-ids';
import { TranslationProvider } from '@/shared/translation';
import { type ChatSession, type RoomFooter } from '@/domains/chat';

import { Room } from './Room';

function makeSession(footer?: Observable<RoomFooter>): ChatSession {
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
  } as unknown as ChatSession;
}

function renderRoom(session: ChatSession) {
  return render(
    <TranslationProvider>
      <Room session={session} />
    </TranslationProvider>,
  );
}

describe('Room', () => {
  it('shows the composer for a session without a footer', async () => {
    renderRoom(makeSession());

    expect(await screen.findByTestId(TEST_IDS.chatMessageInput)).toBeInTheDocument();
  });

  it('hides the composer for a session whose footer is none', async () => {
    renderRoom(makeSession(of({ type: 'none' })));

    await screen.findByTestId(TEST_IDS.chatNoMessagesPlaceholder);
    expect(screen.queryByTestId(TEST_IDS.chatMessageInput)).toBeNull();
  });

  it('hides the composer for a session whose footer is a card', async () => {
    renderRoom(
      makeSession(of({ type: 'card', productId: 'coinflip.dot', messageType: 'scoreboard', payload: new Uint8Array([1]) })),
    );

    await screen.findByTestId(TEST_IDS.chatNoMessagesPlaceholder);
    expect(screen.queryByTestId(TEST_IDS.chatMessageInput)).toBeNull();
  });
});
