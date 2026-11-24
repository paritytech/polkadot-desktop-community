// @vitest-environment happy-dom

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { TranslationProvider } from '@/shared/translation';
import { type ChatMessage, type ChatMessageStatus } from '@/domains/chat';

import { MessageBubble, StatusIcon } from './MessageBubble';

const outgoing = (state: 'new' | 'sent' | 'delivered'): ChatMessageStatus => ({ direction: 'outgoing', state });

describe('StatusIcon', () => {
  it('shows a clock for an outgoing new message', () => {
    const { container } = render(<StatusIcon status={outgoing('new')} />);

    expect(container.querySelector('.lucide-clock')).not.toBeNull();
  });

  it.each(['sent', 'delivered'] as const)('shows one check for an outgoing %s message', state => {
    const { container } = render(<StatusIcon status={outgoing(state)} />);

    expect(container.querySelector('.lucide-check')).not.toBeNull();
    expect(container.querySelector('.lucide-check-check')).toBeNull();
  });

  it('shows a double check for a seen outgoing message', () => {
    const { container } = render(<StatusIcon status={outgoing('delivered')} isSeen />);

    expect(container.querySelector('.lucide-check-check')).not.toBeNull();
  });

  it('renders nothing for an incoming message', () => {
    const { container } = render(<StatusIcon status={{ direction: 'incoming', state: 'seen' }} isSeen />);

    expect(container.querySelector('svg')).toBeNull();
  });
});

describe('MessageBubble', () => {
  const message: ChatMessage = {
    messageId: 'm-1',
    sessionId: 'session-1',
    peer: { type: 'p2p', accountId: '0xpeer', name: 'Alice' },
    timestamp: 1_700_000_000_000,
    content: { type: 'text', text: 'hello' },
    status: outgoing('delivered'),
  };

  it('shows a double check on my message the peer has seen', async () => {
    const { container } = render(
      <TranslationProvider>
        <MessageBubble productId="p" roomId="r" message={message} isMe isSeen />
      </TranslationProvider>,
    );

    await screen.findByText('hello');
    expect(container.querySelector('.lucide-check-check')).not.toBeNull();
  });
});
