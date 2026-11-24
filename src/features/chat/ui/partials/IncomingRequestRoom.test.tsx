// @vitest-environment happy-dom

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { TranslationProvider } from '@/shared/translation';
import { type P2PChatRequest } from '@/domains/chat';

import { IncomingRequestRoom } from './IncomingRequestRoom';

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

const renderRoom = (props: Partial<Extract<Parameters<typeof IncomingRequestRoom>[0], { cancelled?: false }>> = {}) =>
  render(
    <TranslationProvider>
      <IncomingRequestRoom
        request={props.request ?? baseRequest}
        hideByDefault={props.hideByDefault ?? true}
        onAccept={props.onAccept ?? vi.fn()}
        onDecline={props.onDecline ?? vi.fn()}
        onReveal={props.onReveal ?? vi.fn()}
      />
    </TranslationProvider>,
  );

// The Radix trigger is the only button carrying aria-expanded.
const getHeaderMenuTrigger = () => screen.getByRole('button', { expanded: false });
const queryHeaderMenuTrigger = () => screen.queryByRole('button', { expanded: false });

describe('IncomingRequestRoom', () => {
  it('hides the message and offers View message when hidden by default', () => {
    renderRoom({ hideByDefault: true });

    expect(screen.getByText('Message hidden based on your default settings')).toBeInTheDocument();
    expect(screen.queryByText("Hi! Here's the update we discussed.")).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View message' })).toBeInTheDocument();
  });

  it('reveals the message on View message', async () => {
    const onReveal = vi.fn();
    renderRoom({ hideByDefault: true, onReveal });

    await userEvent.click(screen.getByRole('button', { name: 'View message' }));
    expect(onReveal).toHaveBeenCalledWith(baseRequest);
  });

  it('shows the message and no View message once revealed', () => {
    renderRoom({ request: { ...baseRequest, revealed: true }, hideByDefault: true });

    expect(screen.getByText("Hi! Here's the update we discussed.")).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'View message' })).not.toBeInTheDocument();
  });

  it('shows the message when hiding is disabled', () => {
    renderRoom({ hideByDefault: false });

    expect(screen.getByText("Hi! Here's the update we discussed.")).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'View message' })).not.toBeInTheDocument();
  });

  it('wires the banner actions', async () => {
    const onAccept = vi.fn();
    const onDecline = vi.fn();
    renderRoom({ onAccept, onDecline });

    await userEvent.click(screen.getByRole('button', { name: 'Accept' }));
    expect(onAccept).toHaveBeenCalledOnce();
    await userEvent.click(screen.getByRole('button', { name: 'Decline' }));
    expect(onDecline).toHaveBeenCalledOnce();
  });

  it('offers Decline in the header menu while pending', async () => {
    const onDecline = vi.fn();
    renderRoom({ onDecline });

    await userEvent.click(getHeaderMenuTrigger());
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Decline' }));
    expect(onDecline).toHaveBeenCalledOnce();
  });

  it('shows the cancel notice and no accept button when cancelled', () => {
    render(
      <TranslationProvider>
        <IncomingRequestRoom cancelled request={baseRequest} hideByDefault={false} onReveal={vi.fn()} />
      </TranslationProvider>,
    );

    expect(
      screen.getByText((_, element) => element?.textContent === 'mysticRiver.88 cancelled this chat request.', {
        selector: 'p',
      }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Accept' })).not.toBeInTheDocument();
    expect(screen.getByText("Hi! Here's the update we discussed.")).toBeInTheDocument();
    expect(queryHeaderMenuTrigger()).not.toBeInTheDocument();
  });
});
