import { type Observable, firstValueFrom, of, toArray } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { type MessagePosition } from '../session/types';

import { p2pRoomsResource } from './resource';
import { createP2PChatSession } from './session';
import { type P2PChatManager, type P2PPeer, type P2PRoom } from './types';

const peer: P2PPeer = { type: 'p2p', accountId: 'peer', name: 'Peer' };

const room = (overrides: Partial<P2PRoom> = {}): P2PRoom => ({
  sessionId: 's1',
  peerId: 'peer',
  peerUsername: 'Peer',
  userId: 'me',
  createdAt: 0,
  lastUpdate: 0,
  ...overrides,
});

const manager: P2PChatManager = {
  isReady: true,
  searchPeers: vi.fn(),
  startSession: vi.fn(),
  removeSession: vi.fn(),
  sendMessage: vi.fn(),
  markAsRead: vi.fn(),
  sendRequest: vi.fn(),
  acceptRequest: vi.fn(),
  declineRequest: vi.fn(),
  revealRequest: vi.fn(),
  cancelOutgoingRequest: vi.fn(),
  setBlocked: vi.fn(),
  initialize: vi.fn(),
  dispose: vi.fn(),
};

describe('createP2PChatSession peerSeen', () => {
  it('emits the room peerSeen position', async () => {
    const position = { timestamp: 5, messageId: 'm' };
    const live = room({ peerSeen: position });
    p2pRoomsResource.instead(() => of([live]));

    const session = createP2PChatSession(peer, live, manager);

    await expect(firstValueFrom(session.peerSeen ?? of(undefined))).resolves.toEqual(position);
  });

  it('emits null when the room has none', async () => {
    const live = room();
    p2pRoomsResource.instead(() => of([live]));

    const session = createP2PChatSession(peer, live, manager);

    await expect(firstValueFrom(session.peerSeen ?? of(undefined))).resolves.toBeNull();
  });

  it('emits again only when the position advances, not for an equal one', async () => {
    const live = room({ peerSeen: { timestamp: 5, messageId: 'm' } });
    p2pRoomsResource.instead(() =>
      of([live], [room({ peerSeen: { timestamp: 5, messageId: 'm' } })], [room({ peerSeen: { timestamp: 9, messageId: 'n' } })]),
    );

    const session = createP2PChatSession(peer, live, manager);

    const peerSeen$: Observable<Nullable<MessagePosition>> = session.peerSeen ?? of(null);

    await expect(firstValueFrom(peerSeen$.pipe(toArray()))).resolves.toEqual([
      { timestamp: 5, messageId: 'm' },
      { timestamp: 9, messageId: 'n' },
    ]);
  });
});
