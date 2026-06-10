import 'fake-indexeddb/auto';

import { beforeEach, describe, expect, it } from 'vitest';

import { type ChatMessage } from '../session/types';

import { listMessagesChangedSince, stampMessage } from './listChanged';
import { p2pChatDatabase } from './repository';

describe('listMessagesChangedSince', () => {
  beforeEach(async () => {
    await p2pChatDatabase.messages.clear();
  });

  it('returns only messages with lastUpdate > t', async () => {
    const base: Omit<ChatMessage, 'messageId'> = {
      sessionId: 's1',
      peer: { type: 'p2p', accountId: 'peer1', name: 'peer' },
      timestamp: 0,
      content: { type: 'text', text: 'x' },
      status: { direction: 'incoming', state: 'new' },
    };
    await p2pChatDatabase.messages.put(stampMessage({ ...base, messageId: 'm1' }));
    await new Promise(r => setTimeout(r, 5));
    const cutoff = Date.now();
    await new Promise(r => setTimeout(r, 5));
    await p2pChatDatabase.messages.put(stampMessage({ ...base, messageId: 'm2' }));

    const got = await listMessagesChangedSince(cutoff);
    expect(got.map(m => m.messageId)).toEqual(['m2']);
  });
});
