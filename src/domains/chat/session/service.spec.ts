import { describe, expect, it } from 'vitest';

import { chatMessageService } from './service';
import { type ChatMessageStatus, type MessageContent } from './types';

describe('chatMessageService.isSyncCarrier', () => {
  it('marks deviceChatAccepted as a sync carrier (never user-visible)', () => {
    const content: MessageContent = {
      type: 'deviceChatAccepted',
      requestId: 'req-1',
      statementAccountId: '0x01',
      encryptionPublicKey: '0x02',
    };

    expect(chatMessageService.isSyncCarrier(content)).toBe(true);
  });

  it('marks deviceAdded as a sync carrier (never user-visible)', () => {
    const content: MessageContent = {
      type: 'deviceAdded',
      statementAccountId: '0x01',
      encryptionPublicKey: '0x02',
    };

    expect(chatMessageService.isSyncCarrier(content)).toBe(true);
  });

  it('marks token as a sync carrier (peer push token — never user-visible)', () => {
    const content: MessageContent = {
      type: 'token',
      token: 'ab'.repeat(16),
      platform: 'Android',
    };

    expect(chatMessageService.isSyncCarrier(content)).toBe(true);
  });

  it('does not mark user-facing content as a sync carrier', () => {
    const visible: MessageContent[] = [
      { type: 'text', text: 'hi' },
      { type: 'contactAdded' },
      { type: 'leftChat' },
      { type: 'transfer', kind: 'coinage', amount: 1n },
    ];

    for (const content of visible) {
      expect(chatMessageService.isSyncCarrier(content)).toBe(false);
    }
  });
});

describe('chatMessageService.shouldUpgradeStatus', () => {
  const incoming = (state: 'new' | 'seen'): ChatMessageStatus => ({ direction: 'incoming', state });
  const outgoing = (state: 'new' | 'sent' | 'delivered'): ChatMessageStatus => ({ direction: 'outgoing', state });

  it('upgrades incoming new → seen', () => {
    expect(chatMessageService.shouldUpgradeStatus(incoming('new'), incoming('seen'))).toBe(true);
  });

  it('refuses to regress incoming seen → new (the reload read-state bug)', () => {
    expect(chatMessageService.shouldUpgradeStatus(incoming('seen'), incoming('new'))).toBe(false);
  });

  it('upgrades outgoing sent → delivered', () => {
    expect(chatMessageService.shouldUpgradeStatus(outgoing('sent'), outgoing('delivered'))).toBe(true);
  });

  it('refuses to regress outgoing delivered → new', () => {
    expect(chatMessageService.shouldUpgradeStatus(outgoing('delivered'), outgoing('new'))).toBe(false);
  });

  it('refuses an identical re-write (no change)', () => {
    expect(chatMessageService.shouldUpgradeStatus(incoming('seen'), incoming('seen'))).toBe(false);
  });

  it('never crosses direction', () => {
    expect(chatMessageService.shouldUpgradeStatus(outgoing('new'), incoming('seen'))).toBe(false);
    expect(chatMessageService.shouldUpgradeStatus(incoming('new'), outgoing('delivered'))).toBe(false);
  });
});
