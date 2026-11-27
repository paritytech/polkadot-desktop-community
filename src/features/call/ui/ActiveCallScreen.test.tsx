// @vitest-environment happy-dom

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { ActiveCallScreen } from './ActiveCallScreen';

// Prevent happy-dom from rejecting srcObject assignment with non-real MediaStream objects.
// Stub on HTMLMediaElement so BOTH <video> and <audio> are covered.
beforeAll(() => {
  Object.defineProperty(HTMLMediaElement.prototype, 'srcObject', {
    set: vi.fn(),
    get: vi.fn(() => null),
    configurable: true,
  });
});

const defaultProps = {
  name: 'Bob',
  durationLabel: '0:04',
  isVideo: false,
  cameraEnabled: true,
  microphoneEnabled: true,
  remoteMicEnabled: true,
  remoteStream: null,
  localStream: null,
  videoLabel: 'Video',
  muteLabel: 'Mute',
  unmuteLabel: 'Unmute',
  endLabel: 'End',
  micOffSelfLabel: 'Your microphone is off',
  micOffPeerLabel: 'Bob microphone is off',
  switchTitle: 'Switch to video call?',
  switchBody: "We'll end the current voice call and immediately restart it as a video call",
  switchCancelLabel: 'Cancel',
  switchConfirmLabel: 'Switch',
  pendingUpgrade: 'idle' as const,
  upgradeRequestTitle: 'Bob wants to switch the call to video',
  upgradeCancelLabel: 'Cancel',
  upgradeConfirmLabel: 'Switch',
  videoIcon: <span>video-icon</span>,
  muteIcon: <span>mute-icon</span>,
  endIcon: <span>end-icon</span>,
  onToggleCamera: vi.fn(),
  onToggleMicrophone: vi.fn(),
  onRequestVideoUpgrade: vi.fn(),
  onAcceptVideoUpgrade: vi.fn(),
  onDeclineVideoUpgrade: vi.fn(),
  onEnd: vi.fn(),
  outputDeviceId: null,
  settingsLabel: 'Call settings',
  onOpenSettings: vi.fn(),
};

// A remote MediaStream stub. `hasVideo` decides whether the video stage renders.
const remoteStreamStub = (hasVideo: boolean) =>
  ({
    getAudioTracks: () => [],
    getVideoTracks: () => (hasVideo ? [{}] : []),
    getTracks: () => [],
  }) as unknown as MediaStream;

describe('ActiveCallScreen', () => {
  it('renders the peer name', () => {
    render(<ActiveCallScreen {...defaultProps} />);
    expect(screen.getByText('Bob')).toBeDefined();
  });

  it('renders the duration label', () => {
    render(<ActiveCallScreen {...defaultProps} />);
    expect(screen.getByText('0:04')).toBeDefined();
  });

  it('renders avatar (not remote video) when the remote stream has no video track', () => {
    render(<ActiveCallScreen {...defaultProps} isVideo={false} remoteStream={remoteStreamStub(false)} />);
    expect(screen.getByRole('img', { name: 'Bob' })).toHaveTextContent('BO');
  });

  it('renders avatar (not remote video) when remoteStream is null', () => {
    render(<ActiveCallScreen {...defaultProps} isVideo={true} remoteStream={null} />);
    expect(screen.getByRole('img', { name: 'Bob' })).toHaveTextContent('BO');
  });

  it('renders the remote video when the remote stream carries a video track', () => {
    render(<ActiveCallScreen {...defaultProps} isVideo={true} remoteStream={remoteStreamStub(true)} localStream={null} />);
    // Video stage: one visible <video> (the remote), no avatar.
    expect(document.querySelectorAll('video').length).toBeGreaterThan(1); // remote + audio sink
    expect(screen.queryByRole('img', { name: 'Bob' })).toBeNull();
  });

  // The always-present hidden remote-audio-sink <video> is excluded — these
  // assertions are about the self-view / display videos only.
  const visibleVideos = () => [...document.querySelectorAll('video')].filter(v => v.dataset['testid'] !== 'remote-audio-sink');

  it('does not render self-view video when localStream is null', () => {
    render(<ActiveCallScreen {...defaultProps} localStream={null} />);
    expect(visibleVideos().length).toBe(0);
  });

  it('renders self-view video when localStream is provided', () => {
    render(<ActiveCallScreen {...defaultProps} localStream={{} as MediaStream} />);
    expect(visibleVideos().length).toBe(1);
  });

  it('fires onOpenSettings when the settings gear is clicked', async () => {
    const onOpenSettings = vi.fn();
    render(<ActiveCallScreen {...defaultProps} onOpenSettings={onOpenSettings} />);
    await userEvent.click(screen.getByRole('button', { name: 'Call settings' }));
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });

  it('fires onEnd when end button is clicked', async () => {
    const onEnd = vi.fn();
    render(<ActiveCallScreen {...defaultProps} onEnd={onEnd} />);
    await userEvent.click(screen.getByRole('button', { name: 'End' }));
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('fires onToggleCamera when the video button is clicked on a video call', async () => {
    const onToggleCamera = vi.fn();
    render(<ActiveCallScreen {...defaultProps} isVideo={true} onToggleCamera={onToggleCamera} />);
    await userEvent.click(screen.getByRole('button', { name: 'Video' }));
    expect(onToggleCamera).toHaveBeenCalledTimes(1);
  });

  it('opens the requester confirm from the video button on an audio call (does not send yet)', async () => {
    const onRequestVideoUpgrade = vi.fn();
    render(<ActiveCallScreen {...defaultProps} isVideo={false} onRequestVideoUpgrade={onRequestVideoUpgrade} />);
    expect(screen.queryByText('Switch to video call?')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Video' }));
    expect(screen.getByText('Switch to video call?')).toBeDefined();
    // Request is only sent after the user confirms.
    expect(onRequestVideoUpgrade).not.toHaveBeenCalled();
  });

  it('sends the request when the requester confirms the switch dialog', async () => {
    const onRequestVideoUpgrade = vi.fn();
    render(<ActiveCallScreen {...defaultProps} isVideo={false} onRequestVideoUpgrade={onRequestVideoUpgrade} />);
    await userEvent.click(screen.getByRole('button', { name: 'Video' }));
    await userEvent.click(screen.getByRole('button', { name: 'Switch' }));
    expect(onRequestVideoUpgrade).toHaveBeenCalledTimes(1);
  });

  it('does not send the request when the requester cancels the switch dialog', async () => {
    const onRequestVideoUpgrade = vi.fn();
    render(<ActiveCallScreen {...defaultProps} isVideo={false} onRequestVideoUpgrade={onRequestVideoUpgrade} />);
    await userEvent.click(screen.getByRole('button', { name: 'Video' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onRequestVideoUpgrade).not.toHaveBeenCalled();
    expect(screen.queryByText('Switch to video call?')).toBeNull();
  });

  it('shows the consent modal to the peer when an upgrade request is incoming', () => {
    render(<ActiveCallScreen {...defaultProps} isVideo={false} pendingUpgrade="incoming" />);
    expect(screen.getByText('Bob wants to switch the call to video')).toBeDefined();
  });

  it('fires onAcceptVideoUpgrade when the peer presses Switch', async () => {
    const onAcceptVideoUpgrade = vi.fn();
    render(
      <ActiveCallScreen
        {...defaultProps}
        isVideo={false}
        pendingUpgrade="incoming"
        onAcceptVideoUpgrade={onAcceptVideoUpgrade}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Switch' }));
    expect(onAcceptVideoUpgrade).toHaveBeenCalledTimes(1);
  });

  it('fires onDeclineVideoUpgrade when the peer presses Cancel', async () => {
    const onDeclineVideoUpgrade = vi.fn();
    render(
      <ActiveCallScreen
        {...defaultProps}
        isVideo={false}
        pendingUpgrade="incoming"
        onDeclineVideoUpgrade={onDeclineVideoUpgrade}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onDeclineVideoUpgrade).toHaveBeenCalledTimes(1);
  });

  it('fires onToggleMicrophone when mute button is clicked', async () => {
    const onToggleMicrophone = vi.fn();
    render(<ActiveCallScreen {...defaultProps} onToggleMicrophone={onToggleMicrophone} />);
    await userEvent.click(screen.getByRole('button', { name: 'Mute' }));
    expect(onToggleMicrophone).toHaveBeenCalledTimes(1);
  });

  it('shows no mic-off pills when both mics are on', () => {
    render(<ActiveCallScreen {...defaultProps} microphoneEnabled={true} remoteMicEnabled={true} />);
    expect(screen.queryByText('Your microphone is off')).toBeNull();
    expect(screen.queryByText('Bob microphone is off')).toBeNull();
  });

  it('shows the self mic-off pill when the local mic is muted', () => {
    render(<ActiveCallScreen {...defaultProps} microphoneEnabled={false} />);
    expect(screen.getByText('Your microphone is off')).toBeDefined();
  });

  it('shows the peer mic-off pill when the remote mic is muted', () => {
    render(<ActiveCallScreen {...defaultProps} remoteMicEnabled={false} />);
    expect(screen.getByText('Bob microphone is off')).toBeDefined();
  });

  it('labels the mic control "Mute" when the mic is on and "Unmute" when muted', () => {
    const { rerender } = render(<ActiveCallScreen {...defaultProps} microphoneEnabled={true} />);
    expect(screen.getByRole('button', { name: 'Mute' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Unmute' })).toBeNull();

    rerender(<ActiveCallScreen {...defaultProps} microphoneEnabled={false} />);
    expect(screen.getByRole('button', { name: 'Unmute' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Mute' })).toBeNull();
  });
});
