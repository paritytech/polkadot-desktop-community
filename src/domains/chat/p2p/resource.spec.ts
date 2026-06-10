import 'fake-indexeddb/auto';

import { lastValueFrom } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';

import { type ChatMessage } from '../session/types';

import { p2pChatDatabase } from './repository';
import { createP2PMessage } from './resource';

const peer = { type: 'p2p' as const, accountId: 'peer-1', name: 'User B' };

const incoming = (state: 'new' | 'seen'): ChatMessage => ({
  messageId: 'm1',
  sessionId: 'peer-1',
  peer,
  timestamp: 1000,
  content: { type: 'text', text: 'Hi from iOS!' },
  status: { direction: 'incoming', state },
});

const outgoing = (state: 'new' | 'sent' | 'delivered'): ChatMessage => ({
  messageId: 'm2',
  sessionId: 'peer-1',
  peer,
  timestamp: 2000,
  content: { type: 'text', text: 'hello' },
  status: { direction: 'outgoing', state },
});

describe('createP2PMessage — status preservation on re-write', () => {
  beforeEach(async () => {
    await p2pChatDatabase.messages.clear();
  });

  it('inserts a brand-new incoming message as new (stays unread)', async () => {
    await lastValueFrom(createP2PMessage(incoming('new')));

    const row = await p2pChatDatabase.messages.get('m1');
    expect(row?.status).toEqual({ direction: 'incoming', state: 'new' });
  });

  it('does not regress incoming status from seen → new on history replay', async () => {
    // User opened the chat → the message was persisted as read.
    await p2pChatDatabase.messages.put(incoming('seen'));

    // App reloads → the session replays the on-chain statement, re-deriving the
    // same message with a hardcoded `new` status. The read marker must survive.
    await lastValueFrom(createP2PMessage(incoming('new')));

    const row = await p2pChatDatabase.messages.get('m1');
    expect(row?.status).toEqual({ direction: 'incoming', state: 'seen' });
  });

  it('upgrades incoming status from new → seen', async () => {
    await p2pChatDatabase.messages.put(incoming('new'));

    await lastValueFrom(createP2PMessage(incoming('seen')));

    const row = await p2pChatDatabase.messages.get('m1');
    expect(row?.status).toEqual({ direction: 'incoming', state: 'seen' });
  });

  it('does not regress outgoing status from delivered → new on re-derivation', async () => {
    await p2pChatDatabase.messages.put(outgoing('delivered'));

    await lastValueFrom(createP2PMessage(outgoing('new')));

    const row = await p2pChatDatabase.messages.get('m2');
    expect(row?.status).toEqual({ direction: 'outgoing', state: 'delivered' });
  });
});
