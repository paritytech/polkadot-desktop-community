// @vitest-environment happy-dom

import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { TranslationProvider } from '@/shared/translation';
import { type CallSignalContent, type ChatMessage } from '@/domains/chat';
import { canPlaceCallAnyOf } from '../../di';
import { type CallState } from '../helpers/callState';

import { CallMessageBubble } from './CallMessageBubble';

const content: CallSignalContent = { type: 'callSignal', signal: 'offer', purpose: 'audio' };

const buildMessage = (isMe: boolean): ChatMessage => ({
  messageId: 'offer-1',
  sessionId: 'session-1',
  peer: { type: 'p2p', accountId: '0xpeer', name: 'Alice' },
  timestamp: 1_700_000_000_000,
  content,
  status: isMe ? { direction: 'outgoing', state: 'sent' } : { direction: 'incoming', state: 'seen' },
});

// The call feature answers the probe with a plain handler; the test plays that role.
const callAvailableHandler = { key: 'test: calls available', available: () => true, body: () => true };

const renderBubble = (state: CallState, isMe: boolean, isSeen = false) =>
  render(
    <TranslationProvider>
      <CallMessageBubble message={buildMessage(isMe)} content={content} state={state} isMe={isMe} isSeen={isSeen} />
    </TranslationProvider>,
  );

type Case = { name: string; state: CallState; isMe: boolean; mobile: string; tap: string };

const cases: Case[] = [
  {
    name: 'an incoming call still ringing',
    state: { kind: 'calling' },
    isMe: false,
    mobile: 'Open Mobile App to call',
    tap: 'Tap to call',
  },
  {
    name: 'a call in progress',
    state: { kind: 'active' },
    isMe: false,
    mobile: 'Open Mobile App to return',
    tap: 'Tap to return',
  },
  {
    name: 'a missed call',
    state: { kind: 'missed' },
    isMe: false,
    mobile: 'Open Mobile App to call back',
    tap: 'Tap to call back',
  },
  {
    name: 'a call I cancelled',
    state: { kind: 'cancelled', ringDurationMs: 4000 },
    isMe: true,
    mobile: 'Open Mobile App to call again',
    tap: 'Tap to call again',
  },
  {
    name: 'a call the contact cancelled',
    state: { kind: 'cancelled', ringDurationMs: 4000 },
    isMe: false,
    mobile: 'Open Mobile App to call back',
    tap: 'Tap to call back',
  },
];

afterEach(() => {
  canPlaceCallAnyOf.removeHandler(callAvailableHandler);
});

describe('CallMessageBubble', () => {
  describe('when nothing in the build can place a call', () => {
    for (const { name, state, isMe, mobile } of cases) {
      it(`points at the mobile app for ${name}`, () => {
        renderBubble(state, isMe);

        expect(screen.getByText(mobile)).toBeTruthy();
      });
    }
  });

  describe('when a feature can place a call', () => {
    for (const { name, state, isMe, tap } of cases) {
      it(`invites a tap for ${name}`, () => {
        canPlaceCallAnyOf.registerHandler(callAvailableHandler);

        renderBubble(state, isMe);

        expect(screen.getByText(tap)).toBeTruthy();
      });
    }
  });

  it('shows a double check on my call the peer has seen', () => {
    const { container } = renderBubble({ kind: 'calling' }, true, true);

    expect(container.querySelector('.lucide-check-check')).not.toBeNull();
  });

  it('keeps showing the duration for a finished call', () => {
    canPlaceCallAnyOf.registerHandler(callAvailableHandler);

    renderBubble({ kind: 'finished', durationMs: 65_000 }, false);

    expect(screen.queryByText(/Tap to/)).toBeNull();
    expect(screen.queryByText(/Open Mobile App/)).toBeNull();
  });
});
