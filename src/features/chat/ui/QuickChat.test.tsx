// @vitest-environment happy-dom

import 'fake-indexeddb/auto';

import { RouterProvider, createMemoryHistory, createRootRoute, createRouter } from '@tanstack/react-router';
import { fireEvent, render, screen } from '@testing-library/react';
import { of } from 'rxjs';
import { afterEach, describe, expect, it } from 'vitest';

import { TEST_IDS } from '@/shared/test-ids';
import { TranslationProvider } from '@/shared/translation';
import { type ProductChatRoom, roomsResource } from '@/domains/chat';
import { truapiRuntimeUseCase } from '@/aggregates/truapi-runtime';

import { QuickChat } from './QuickChat';

const USER = `0x${'11'.repeat(32)}` as ProductChatRoom['userId'];

const room: ProductChatRoom = { sessionId: 's1', roomId: 'room-1', productId: 'demo.dot', userId: USER, createdAt: 1 };

async function renderQuickChat(served: ProductChatRoom) {
  truapiRuntimeUseCase.publishAuthState({ tag: 'Connected', value: { publicKey: USER, identityAccountId: USER } });
  roomsResource.instead(() => of([served]));

  const rootRoute = createRootRoute({
    component: () => (
      <TranslationProvider>
        <QuickChat open onOpenChange={() => {}}>
          <button>trigger</button>
        </QuickChat>
      </TranslationProvider>
    ),
  });
  const router = createRouter({ routeTree: rootRoute, history: createMemoryHistory({ initialEntries: ['/'] }) });
  await router.load();

  render(<RouterProvider router={router} />);
  fireEvent.click(await screen.findByTestId(TEST_IDS.chatRoomItem));
}

afterEach(() => {
  truapiRuntimeUseCase.dispose();
});

describe('QuickChat', () => {
  it('hides the composer in a product room whose footer is none', async () => {
    await renderQuickChat({ ...room, footer: { type: 'none' } });

    await screen.findByTestId(TEST_IDS.chatNoMessagesPlaceholder);
    expect(screen.queryByTestId(TEST_IDS.chatMessageInput)).toBeNull();
  });

  it('draws the card instead of the composer in a product room whose footer is a card', async () => {
    await renderQuickChat({
      ...room,
      footer: { type: 'card', productId: 'demo.dot', messageType: 'scoreboard', payload: new Uint8Array([1]) },
    });

    expect(await screen.findByTestId(TEST_IDS.chatRoomFooterCard)).toBeInTheDocument();
    expect(screen.queryByTestId(TEST_IDS.chatMessageInput)).toBeNull();
  });

  it('shows the composer in a product room without a footer', async () => {
    await renderQuickChat(room);

    expect(await screen.findByTestId(TEST_IDS.chatMessageInput)).toBeInTheDocument();
  });
});
