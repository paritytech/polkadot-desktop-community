// @vitest-environment happy-dom

import { render, screen } from '@testing-library/react';
import { type FC, type SVGProps } from 'react';
import { describe, expect, it } from 'vitest';

import { CheckCheckIcon, CheckIcon, ClockIcon } from '@/shared/icons';
import { TranslationProvider } from '@/shared/translation';
import { type ChatMessage, type ChatMessageStatus } from '@/domains/chat';

import { MessageBubble, StatusIcon } from './MessageBubble';

const markupOf = (Icon: FC<SVGProps<SVGSVGElement>>) => render(<Icon />).container.querySelector('svg')?.innerHTML;
const iconMarkups = (container: HTMLElement) => Array.from(container.querySelectorAll('svg'), svg => svg.innerHTML);

const outgoing = (state: 'new' | 'sent' | 'delivered'): ChatMessageStatus => ({ direction: 'outgoing', state });

describe('StatusIcon', () => {
  it('shows a clock for an outgoing new message', () => {
    const { container } = render(<StatusIcon status={outgoing('new')} />);

    expect(iconMarkups(container)).toContain(markupOf(ClockIcon));
  });

  it.each(['sent', 'delivered'] as const)('shows one check for an outgoing %s message', state => {
    const { container } = render(<StatusIcon status={outgoing(state)} />);

    expect(iconMarkups(container)).toContain(markupOf(CheckIcon));
    expect(iconMarkups(container)).not.toContain(markupOf(CheckCheckIcon));
  });

  it('shows a double check for a seen outgoing message', () => {
    const { container } = render(<StatusIcon status={outgoing('delivered')} isSeen />);

    expect(iconMarkups(container)).toContain(markupOf(CheckCheckIcon));
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
    expect(iconMarkups(container)).toContain(markupOf(CheckCheckIcon));
  });

  it('draws the quoted card of my reply in the inverted tone', async () => {
    const quoted: ChatMessage = { ...message, messageId: 'm-0', content: { type: 'text', text: 'the original' } };

    render(
      <TranslationProvider>
        <MessageBubble productId="p" roomId="r" message={message} isMe quotedMessage={quoted} quotedSenderName="Alice" />
      </TranslationProvider>,
    );

    const quotedText = await screen.findByText('the original');
    expect(quotedText.closest('.bg-bg-surface-nested-inverted')).not.toBeNull();
  });
});
