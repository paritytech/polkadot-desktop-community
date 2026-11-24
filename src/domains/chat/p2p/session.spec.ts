import { firstValueFrom, of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

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
});
