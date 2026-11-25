// @vitest-environment happy-dom

import { Outlet, RouterProvider, createMemoryHistory, createRootRoute, createRoute, createRouter } from '@tanstack/react-router';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type PropsWithChildren } from 'react';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const toastErrorMock = vi.fn();

vi.mock('@novasamatech/tr-ui', async () => {
  const actual = await vi.importActual<object>('@novasamatech/tr-ui');

  return { ...actual, toastError: (...args: unknown[]) => toastErrorMock(...args) };
});

import { DropdownMenu } from '@/shared/components';
import { TranslationProvider } from '@/shared/translation';
import { type ProductChatRoom, roomsResource } from '@/domains/chat';
import { type AccountId } from '@/domains/network';
import { type PersistedProduct, commitmentUseCase, productsResource } from '@/domains/product';
import { browserTabs } from '@/aggregates/browser-tabs';
import { truapiRuntime } from '@/aggregates/truapi-runtime';

import { ProceedInChatMenuItem } from './ProceedInChatMenuItem';

// The commit is a write with no resource to state it on: the use-case method is spied in
// place, and `useCommitProductByIdentifier` — a `useAction` over it — runs for real.
const commitRunMock = vi.spyOn(commitmentUseCase, 'commitProductByIdentifier').mockResolvedValue(null);

const PRODUCT_ID = 'my-app.dot';
const USER_ID = '0x1111111111111111111111111111111111111111111111111111111111111111' as AccountId;

// The rooms read is keyed by the signed-in user, so a connected session is what
// makes it run at all.
function seedSession() {
  truapiRuntime.set(prev => ({
    ...prev,
    authState: { tag: 'Connected', value: { identityAccountId: USER_ID, publicKey: USER_ID } } as never,
  }));
}

function chatProductRecord() {
  return {
    baseName: PRODUCT_ID,
    displayName: 'My App',
    description: '',
    icon: { cid: '', format: 'png' },
    executables: { worker: { includes: { chat: true } } },
    pinned: false,
    createdAt: 1000,
    updatedAt: 1000,
  } as unknown as PersistedProduct;
}

const committedRecord = chatProductRecord();

function seedChatProduct() {
  productsResource.instead(() => of([committedRecord]));
}

function seedRooms(rooms: ProductChatRoom[]) {
  roomsResource.instead(() => of(rooms));
}

// The item is a Radix `DropdownMenu.Item`, which only renders inside an open menu; a
// real one is mounted around it so the item's own selection handling is what runs.
const MenuHost = ({ children }: PropsWithChildren) => (
  <DropdownMenu.Root open>
    <DropdownMenu.Trigger asChild>
      <button type="button">menu</button>
    </DropdownMenu.Trigger>
    <DropdownMenu.Content>{children}</DropdownMenu.Content>
  </DropdownMenu.Root>
);

// Both open hooks navigate through `useNavigate`, so the item renders inside a real
// router over an in-memory history; assertions read where it went and which tab it chose.
const renderItem = async () => {
  const rootRoute = createRootRoute({
    component: () => (
      <>
        <TranslationProvider>
          <MenuHost>
            <ProceedInChatMenuItem productId={PRODUCT_ID} closeMenu={vi.fn()} />
          </MenuHost>
        </TranslationProvider>
        <Outlet />
      </>
    ),
  });
  const routeTree = rootRoute.addChildren(
    ['/', '/chat/{-$chatId}'].map(path => createRoute({ getParentRoute: () => rootRoute, path })),
  );
  const router = createRouter({ routeTree, history: createMemoryHistory({ initialEntries: ['/'] }) });
  // A RouterProvider renders nothing until the router has matched its first location.
  await router.load();
  render(<RouterProvider router={router} />);

  return { router };
};

describe('ProceedInChatMenuItem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    seedSession();
    seedChatProduct();
    commitRunMock.mockResolvedValue(committedRecord);
  });

  it('navigates directly to the chat room when it already exists', async () => {
    seedRooms([{ sessionId: '0xsession', roomId: 'my-app', productId: PRODUCT_ID, userId: USER_ID, createdAt: 1000 }]);
    const { router } = await renderItem();

    await userEvent.click(await screen.findByRole('menuitem'));

    await waitFor(() => expect(router.state.location.pathname).toBe('/chat/0xsession'));
    expect(browserTabs.selectedTabId$.get()).toBe('chat');
    expect(commitRunMock).not.toHaveBeenCalled();
  });

  it('opens the chat tab and commits the product when no room exists yet', async () => {
    const { router } = await renderItem();

    await userEvent.click(await screen.findByRole('menuitem'));

    await waitFor(() => expect(router.state.location.pathname).toBe('/chat'));
    expect(commitRunMock).toHaveBeenCalledWith(PRODUCT_ID);
    expect(browserTabs.selectedTabId$.get()).toBe('chat');
    expect(toastErrorMock).not.toHaveBeenCalled();
  });

  it('surfaces an error when the product cannot be resolved, so no room will ever arrive', async () => {
    commitRunMock.mockResolvedValue(null);
    await renderItem();

    await userEvent.click(await screen.findByRole('menuitem'));

    expect(toastErrorMock).toHaveBeenCalled();
  });

  it('surfaces an error when the commit itself fails', async () => {
    commitRunMock.mockRejectedValue(new Error('offline'));
    await renderItem();

    await userEvent.click(await screen.findByRole('menuitem'));

    expect(toastErrorMock).toHaveBeenCalled();
  });
});
