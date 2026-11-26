import { MicOff, Settings } from 'lucide-react';
import { type ReactNode, type SyntheticEvent, useCallback, useEffect, useRef, useState } from 'react';

import { Button, IconButton } from '@/shared/components';
import { cnTw } from '@/shared/utils';
import { type PendingUpgrade } from '@/domains/chat';

import { CallAvatar } from './CallAvatar';
import { CallControlButton } from './CallControlButton';

type ActiveCallScreenProps = {
  name: string;
  durationLabel: string;
  isVideo: boolean;
  cameraEnabled: boolean;
  microphoneEnabled: boolean;
  remoteMicEnabled: boolean;
  remoteStream: Nullable<MediaStream>;
  localStream: Nullable<MediaStream>;
  videoLabel: string;
  muteLabel: string;
  unmuteLabel: string;
  endLabel: string;
  micOffSelfLabel: string;
  micOffPeerLabel: string;
  // Requester-side confirm shown before the switch request is sent to the peer.
  switchTitle: string;
  switchBody: string;
  switchCancelLabel: string;
  switchConfirmLabel: string;
  // Consent-gated audio→video upgrade. 'outgoing' — we asked, awaiting the peer;
  // 'incoming' — the peer asked, so the consent modal is shown.
  pendingUpgrade: PendingUpgrade;
  upgradeRequestTitle: string;
  upgradeCancelLabel: string;
  upgradeConfirmLabel: string;
  videoIcon: ReactNode;
  muteIcon: ReactNode;
  endIcon: ReactNode;
  onToggleCamera: VoidFunction;
  onToggleMicrophone: VoidFunction;
  onRequestVideoUpgrade: VoidFunction;
  onAcceptVideoUpgrade: VoidFunction;
  onDeclineVideoUpgrade: VoidFunction;
  onEnd: VoidFunction;
  outputDeviceId: Nullable<string>;
  settingsLabel: string;
  onOpenSettings: VoidFunction;
};

// Small pill shown near the controls when a participant's mic is muted.
const MicOffPill = ({ label }: { label: string }) => (
  <div className="flex items-center gap-2 rounded-full bg-bg-surface-nested px-3 py-1.5">
    <MicOff className="size-4 shrink-0 text-fg-primary" />
    <span className="text-sm text-fg-primary">{label}</span>
  </div>
);

export const ActiveCallScreen = ({
  name,
  durationLabel,
  isVideo,
  cameraEnabled,
  microphoneEnabled,
  remoteMicEnabled,
  remoteStream,
  localStream,
  videoLabel,
  muteLabel,
  unmuteLabel,
  endLabel,
  micOffSelfLabel,
  micOffPeerLabel,
  switchTitle,
  switchBody,
  switchCancelLabel,
  switchConfirmLabel,
  pendingUpgrade,
  upgradeRequestTitle,
  upgradeCancelLabel,
  upgradeConfirmLabel,
  videoIcon,
  muteIcon,
  endIcon,
  onToggleCamera,
  onToggleMicrophone,
  onRequestVideoUpgrade,
  onAcceptVideoUpgrade,
  onDeclineVideoUpgrade,
  onEnd,
  outputDeviceId,
  settingsLabel,
  onOpenSettings,
}: ActiveCallScreenProps) => {
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  // The remote-audio sink is a visually-hidden <video>, NOT an <audio> element.
  // In Electron/Chromium a bare <audio> element frequently stays silent for a
  // remote WebRTC MediaStream even when play() resolves; a <video> element is
  // the reliable audio sink. It is unmuted and kept rendered offscreen (see the
  // element), while the visible display <video> below is muted, so audio never
  // double-plays.
  const remoteAudioSinkRef = useRef<HTMLVideoElement>(null);

  const attachRemoteStream = useCallback(() => {
    const audioEl = remoteAudioSinkRef.current;
    const videoEl = remoteVideoRef.current;

    // Autoplay is granted app-wide (main sets --autoplay-policy=no-user-gesture-required),
    // so play() should not be gesture-blocked here; if it ever is, resume on the
    // first interaction with the window — the user is in a call, so a click/keypress
    // is imminent. The listeners are torn down after the first successful resume
    // (or on cleanup).
    let removeGestureResume: Nullable<VoidFunction> = null;
    function resumeOnGesture(el: HTMLMediaElement): void {
      if (removeGestureResume) return;
      const handler = () => {
        el.play()
          .then(() => {
            removeGestureResume?.();
            removeGestureResume = null;
          })
          .catch(() => {});
      };
      window.addEventListener('pointerdown', handler);
      window.addEventListener('keydown', handler);
      removeGestureResume = () => {
        window.removeEventListener('pointerdown', handler);
        window.removeEventListener('keydown', handler);
      };
    }

    // Remote AUDIO plays through the hidden audio-sink <video>. We attach a fresh
    // audio-ONLY MediaStream (not the mixed a/v stream) so track selection is
    // unambiguous, and force muted=false/volume=1 in case a prior state left it
    // silenced. The display <video> below is muted imperatively so audio never
    // double-plays.
    if (audioEl) {
      const audioTracks = remoteStream?.getAudioTracks() ?? [];
      audioEl.srcObject = audioTracks.length > 0 ? new MediaStream(audioTracks) : null;
      audioEl.muted = false;
      audioEl.volume = 1;
      // Route remote audio to the chosen output device. setSinkId is typed on
      // HTMLMediaElement (Electron/Chromium supports it); '' selects the system
      // default. Guarded for environments (tests) where it is absent, and the
      // promise is caught since a removed device rejects it.
      if (typeof audioEl.setSinkId === 'function') {
        audioEl.setSinkId(outputDeviceId ?? '').catch(err => {
          console.warn('[CALL] setSinkId failed — using current output:', err);
        });
      }
      if (audioTracks.length > 0) {
        console.info('[CALL] remote audio sink: %d audio track(s) attached — play()', audioTracks.length);
        audioEl.play().catch(err => {
          console.error('[CALL] remote audio sink play() blocked — will resume on first user gesture:', err);
          resumeOnGesture(audioEl);
        });
      } else {
        console.warn('[CALL] remote stream has no audio track yet — nothing to play');
      }
    }

    if (videoEl && remoteStream) {
      videoEl.srcObject = remoteStream;
      // React does not reliably reflect the `muted` JSX prop onto the media
      // element property (long-standing React issue), so set it imperatively —
      // otherwise the <video> could also play the audio track (double audio).
      videoEl.muted = true;
      videoEl.play().catch(() => {});
    }

    return () => {
      removeGestureResume?.();
      if (audioEl) audioEl.srcObject = null;
      if (videoEl) videoEl.srcObject = null;
    };
  }, [remoteStream, outputDeviceId]);

  // Ref callback (not an effect): the self-view <video> mounts only once the
  // camera is on, which for an audio→video upgrade happens AFTER the local stream
  // already exists (a video track is added to the same stream — its identity does
  // not change, so an effect keyed on [localStream] would not re-run). Binding on
  // the ref guarantees srcObject is set whenever the element (re)mounts.
  const attachLocalVideo = useCallback(
    (el: Nullable<HTMLVideoElement>) => {
      if (el && localStream) el.srcObject = localStream;
    },
    [localStream],
  );

  useEffect(attachRemoteStream, [attachRemoteStream]);

  // Video is shown whenever real video tracks exist — independent of the call's
  // initial purpose — so a mid-call audio→video upgrade displays on both sides.
  const remoteHasVideo = (remoteStream?.getVideoTracks().length ?? 0) > 0;
  const localHasVideo = localStream !== null && cameraEnabled;
  const showVideoStage = remoteHasVideo || localHasVideo;

  // Orientation follows the remote frame's aspect ratio (portrait phone camera
  // vs landscape webcam): a portrait frame is letterboxed (object-contain) in a
  // narrow column, a landscape frame fills the window (object-cover). The
  // self-view PiP takes the opposite orientation to match the Figma layout.
  const [isPortrait, setIsPortrait] = useState(false);
  const handleRemoteMeta = () => {
    const video = remoteVideoRef.current;
    if (video && video.videoWidth > 0) {
      setIsPortrait(video.videoHeight > video.videoWidth);
    }
  };

  // The self-view PiP is sized from its OWN camera aspect ratio, not the remote's.
  // Desktop webcams are landscape, so this defaults to (and stays) horizontal; a
  // portrait phone camera would flip it to a tall box. Deriving it from the remote
  // and inverting (as before) mis-sized the self-view on symmetric desktop calls.
  const [localIsPortrait, setLocalIsPortrait] = useState(false);
  const handleLocalMeta = (event: SyntheticEvent<HTMLVideoElement>) => {
    const video = event.currentTarget;
    if (video.videoWidth > 0) {
      setLocalIsPortrait(video.videoHeight > video.videoWidth);
    }
  };

  const showSelfMicOff = !microphoneEnabled;
  const showPeerMicOff = !remoteMicEnabled;

  const [showSwitchDialog, setShowSwitchDialog] = useState(false);

  const micOffPills =
    showSelfMicOff || showPeerMicOff ? (
      <div className="flex flex-col items-center gap-2">
        {showSelfMicOff && <MicOffPill label={micOffSelfLabel} />}
        {showPeerMicOff && <MicOffPill label={micOffPeerLabel} />}
      </div>
    ) : null;

  // The left control is a camera TOGGLE on a video call, but a switch-to-video
  // REQUEST on an audio call. On audio it opens a local confirm ("Switch to video
  // call?") first; confirming sends the request and the peer sees its own consent
  // modal. While the request is outstanding the button is dimmed so the wait is
  // visible (re-presses are dropped — the reducer guards on pendingUpgrade).
  const upgradePending = pendingUpgrade === 'outgoing';
  const videoButton = isVideo ? (
    <CallControlButton
      label={videoLabel}
      tone="primary"
      size="lg"
      icon={videoIcon}
      active={cameraEnabled}
      onPress={onToggleCamera}
    />
  ) : (
    <CallControlButton
      label={videoLabel}
      tone="secondary"
      size="lg"
      icon={videoIcon}
      active={!upgradePending}
      onPress={() => {
        if (!upgradePending) setShowSwitchDialog(true);
      }}
    />
  );

  const controlsRow = (
    <div className="flex items-center justify-center gap-8">
      {videoButton}
      {/* Muted → the mute button is highlighted (light) with an "Unmute" label
          and a slashed-mic icon, so being muted is obvious. */}
      <CallControlButton
        label={microphoneEnabled ? muteLabel : unmuteLabel}
        tone={microphoneEnabled ? 'secondary' : 'primary'}
        size="lg"
        icon={muteIcon}
        onPress={onToggleMicrophone}
      />
      <CallControlButton label={endLabel} tone="decline" size="lg" icon={endIcon} onPress={onEnd} />
    </div>
  );

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-neutral-900 text-white">
      {/* Remote audio sink — a visually-hidden <video> (reliable remote-audio
          output in Electron, unlike a bare <audio>), always present so sound
          plays on audio-only calls. Kept rendered (offscreen 1px, not
          display:none) so its media pipeline stays active. */}
      <video
        ref={remoteAudioSinkRef}
        autoPlay
        playsInline
        className="pointer-events-none absolute h-px w-px opacity-0"
        data-testid="remote-audio-sink"
      />

      {/* Settings gear — top-right, above the video scrim; opens the call-settings
          device picker. Present on both audio and video layouts. */}
      <span className="absolute end-4 top-4 z-30 flex">
        <IconButton label={settingsLabel} onClick={onOpenSettings}>
          <Settings />
        </IconButton>
      </span>

      {showVideoStage ? (
        <>
          {/* Main stage — remote video fills the window; if the peer has no video
              yet (e.g. we just upgraded and they haven't), show their avatar. */}
          <div className="absolute inset-0 flex items-center justify-center">
            {remoteHasVideo ? (
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                muted
                className={cnTw('h-full w-full', isPortrait ? 'object-contain' : 'object-cover')}
                onLoadedMetadata={handleRemoteMeta}
              />
            ) : (
              <CallAvatar name={name} sizePx={136} />
            )}
          </div>

          {/* Top scrim — name + call duration over a gradient for legibility. */}
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col items-center gap-1 bg-gradient-to-b from-black/70 to-transparent px-6 pt-6 pb-16 text-center">
            <span className="text-2xl font-semibold text-fg-primary">{name}</span>
            <span className="text-base text-fg-primary">{durationLabel}</span>
          </div>

          {/* Self-view PiP — bottom-right, orientation opposite the remote frame. */}
          {localHasVideo && (
            <video
              ref={attachLocalVideo}
              autoPlay
              playsInline
              muted
              className={cnTw(
                'absolute end-4 bottom-4 z-20 rounded-2xl object-cover shadow-lg',
                localIsPortrait ? 'h-[228px] w-[132px]' : 'h-[132px] w-[228px]',
              )}
              onLoadedMetadata={handleLocalMeta}
            />
          )}

          {/* Bottom scrim — mic-off pills stacked above the controls. */}
          <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col items-center gap-4 bg-gradient-to-t from-black/70 to-transparent px-6 pt-16 pb-8">
            {micOffPills}
            {controlsRow}
          </div>
        </>
      ) : (
        <>
          {/* Avatar-centered layout (audio call, or before remote video arrives). */}
          <div className="flex flex-1 flex-col items-center justify-center gap-3">
            <CallAvatar name={name} sizePx={136} />
            <div className="flex flex-col items-center gap-1 text-center">
              <span className="text-2xl font-semibold text-fg-primary">{name}</span>
              <span className="text-base text-fg-primary">{durationLabel}</span>
            </div>
          </div>

          <div className="flex flex-col items-center gap-4 pb-8">
            {micOffPills}
            {controlsRow}
          </div>
        </>
      )}

      {/* Requester-side confirm — shown to the local user when they tap the camera
          on a voice call, before the request is sent to the peer. Confirming sends
          the request; the peer then sees its own consent modal below. */}
      {showSwitchDialog && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/50 p-6">
          <div className="w-full max-w-sm rounded-xl bg-bg-surface-container p-6 shadow-lg">
            <h2 className="mb-2 text-lg font-semibold text-fg-primary">{switchTitle}</h2>
            <p className="mb-6 text-sm text-fg-primary/70">{switchBody}</p>
            <div className="flex gap-3">
              <Button variant="secondary" block onClick={() => setShowSwitchDialog(false)}>
                {switchCancelLabel}
              </Button>
              <Button
                variant="primary"
                block
                onClick={() => {
                  setShowSwitchDialog(false);
                  onRequestVideoUpgrade();
                }}
              >
                {switchConfirmLabel}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Incoming switch-to-video consent modal — shown to the PEER when the
          other side asks to upgrade the audio call. Accepting turns on our camera
          and continues the same call in video; cancelling keeps it audio. */}
      {pendingUpgrade === 'incoming' && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/50 p-6">
          <div className="w-full max-w-sm rounded-xl bg-bg-surface-container p-6 shadow-lg">
            <h2 className="mb-6 text-lg font-semibold text-fg-primary">{upgradeRequestTitle}</h2>
            <div className="flex gap-3">
              <Button variant="secondary" block onClick={onDeclineVideoUpgrade}>
                {upgradeCancelLabel}
              </Button>
              <Button variant="primary" block onClick={onAcceptVideoUpgrade}>
                {upgradeConfirmLabel}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
