// @vitest-environment happy-dom

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { IncomingCallScreen } from './IncomingCallScreen';

const defaultProps = {
  name: 'Alice',
  callTypeLabel: 'Polkadot Audio Call',
  acceptLabel: 'Accept',
  declineLabel: 'Decline',
  acceptIcon: <span>accept-icon</span>,
  declineIcon: <span>decline-icon</span>,
  onAccept: vi.fn(),
  onDecline: vi.fn(),
};

describe('IncomingCallScreen', () => {
  it('renders the peer name', () => {
    render(<IncomingCallScreen {...defaultProps} />);
    expect(screen.getByText('Alice')).toBeDefined();
  });

  it('draws the shared avatar', () => {
    render(<IncomingCallScreen {...defaultProps} />);
    expect(screen.getByRole('img', { name: 'Alice' })).toHaveTextContent(/^AL$/);
  });

  it('renders the call type label', () => {
    render(<IncomingCallScreen {...defaultProps} />);
    expect(screen.getByText('Polkadot Audio Call')).toBeDefined();
  });

  it('renders the accept label', () => {
    render(<IncomingCallScreen {...defaultProps} />);
    expect(screen.getByText('Accept')).toBeDefined();
  });

  it('renders the decline label', () => {
    render(<IncomingCallScreen {...defaultProps} />);
    expect(screen.getByText('Decline')).toBeDefined();
  });

  it('fires onAccept when accept button is clicked', async () => {
    const onAccept = vi.fn();
    render(<IncomingCallScreen {...defaultProps} onAccept={onAccept} />);
    const buttons = screen.getAllByRole('button');
    // Accept button is second (decline left, accept right per design)
    await userEvent.click(buttons[1]!);
    expect(onAccept).toHaveBeenCalledTimes(1);
  });

  it('fires onDecline when decline button is clicked', async () => {
    const onDecline = vi.fn();
    render(<IncomingCallScreen {...defaultProps} onDecline={onDecline} />);
    const buttons = screen.getAllByRole('button');
    // Decline button is first (decline left, accept right per design)
    await userEvent.click(buttons[0]!);
    expect(onDecline).toHaveBeenCalledTimes(1);
  });
});
