// @vitest-environment happy-dom

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { TranslationProvider } from '@/shared/translation';
import { type P2PChatRequest } from '@/domains/chat';

import { RequestItem } from './RequestItem';

const baseRequest: P2PChatRequest = {
  requestId: 'req-1',
  peerId: '0xpeer',
  peerUsername: 'mysticRiver.88',
  direction: 'incoming',
  status: 'pending',
  welcomeMessage: "Hi! Here's the update we discussed.",
  timestamp: Date.now(),
  userId: '0xuser',
  lastUpdate: 0,
};

const renderItem = (props: Partial<Parameters<typeof RequestItem>[0]> = {}) =>
  render(
    <TranslationProvider>
      <RequestItem
        request={props.request ?? baseRequest}
        selected={props.selected ?? false}
        hideByDefault={props.hideByDefault ?? true}
        onSelect={props.onSelect ?? vi.fn()}
        onDecline={props.onDecline ?? vi.fn()}
      />
    </TranslationProvider>,
  );

describe('RequestItem', () => {
  it('shows the name and a hidden placeholder when hidden by default', () => {
    renderItem({ hideByDefault: true });

    expect(screen.getByText('mysticRiver.88')).toBeInTheDocument();
    expect(screen.getByText('Message hidden')).toBeInTheDocument();
    expect(screen.queryByText("Hi! Here's the update we discussed.")).not.toBeInTheDocument();
  });

  it('shows the message preview once revealed', () => {
    renderItem({ request: { ...baseRequest, revealed: true }, hideByDefault: true });

    expect(screen.getByText("Hi! Here's the update we discussed.")).toBeInTheDocument();
  });

  it('opens on row click and declines on the ✕ without opening', async () => {
    const onSelect = vi.fn();
    const onDecline = vi.fn();
    renderItem({ onSelect, onDecline });

    await userEvent.click(screen.getByText('mysticRiver.88'));
    expect(onSelect).toHaveBeenCalledOnce();

    onSelect.mockClear();
    await userEvent.click(screen.getByRole('button', { name: 'Decline' }));
    expect(onDecline).toHaveBeenCalledOnce();
    expect(onSelect).not.toHaveBeenCalled();
  });
});
