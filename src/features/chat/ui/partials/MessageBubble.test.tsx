// @vitest-environment happy-dom

import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { type ChatMessageStatus } from '@/domains/chat';

import { StatusIcon } from './MessageBubble';

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
