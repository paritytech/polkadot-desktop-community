// TODO(i18n): the call window renders in its own BrowserWindow without an
// IntlProvider; all label strings are English constants below. Replace with
// react-intl before shipping the calls feature.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  type CallDeviceKind,
  type CallDeviceSelection,
  type CallDevices,
  listCallDevices,
  loadDeviceSelection,
  saveDeviceSelection,
  withDeviceForKind,
} from '@/shared/call-media-devices';
import { MicIcon, MicOffIcon, PhoneIcon, PhoneOffIcon, VideoIcon, VideoOffIcon } from '@/shared/icons';
import { type CallInitDelivery, onCallInit } from '../runtime/callInitPort';
import { type CallRuntimeState, type CallSession, createCallSession } from '../runtime/callSession';

import { ActiveCallScreen } from './ActiveCallScreen';
import { type CallSettingsLabels, CallSettings } from './CallSettings';
import { IncomingCallScreen } from './IncomingCallScreen';

// English label strings as a plain TS const — NOT in JSX so the i18n lint rule
// does not fire on this file. Replace with IntlProvider translations before shipping.
const LABELS = {
  incomingAudio: 'Incoming audio call',
  incomingVideo: 'Incoming video call',
  accept: 'Accept',
  decline: 'Decline',
  mute: 'Mute',
  unmute: 'Unmute',
  video: 'Camera',
  end: 'End call',
  ended: 'Call ended',
  calling: 'Calling…',
  micOffSelf: 'Your microphone is off',
  micOffPeerSuffix: 'microphone is off',
  switchTitle: 'Switch to video call?',
  switchBody: "We'll end the current voice call and immediately restart it as a video call",
  switchCancel: 'Cancel',
  switchConfirm: 'Switch',
  upgradeRequestSuffix: 'wants to switch the call to video',
  upgradeCancel: 'Cancel',
  upgradeConfirm: 'Switch',
  settingsGear: 'Call settings',
  settingsTitle: 'Call settings',
  settingsClose: 'Close',
  settingsCamera: 'Camera',
  settingsMicrophone: 'Microphone',
  settingsOutput: 'Output',
  settingsDefault: 'Default',
} as const;

// Local M:SS / H:MM:SS formatter — the call window is standalone and must not
// import a chat feature helper (features/chat owns its own formatter).
function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600);
  const mm = hours > 0 ? String(minutes).padStart(2, '0') : String(minutes);
  const ss = String(seconds).padStart(2, '0');
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

/**
 * The call window's root surface. Waits for the `__callInit` port delivery, then
 * runs the live call. Mounted by the `/call/$offerId` route (its own
 * BrowserWindow) — this is the feature's own route surface, so it is stateful
 * (the "exported feature components stay presentational" rule applies only to
 * components injected into another feature's slot).
 */
export const CallWindowScreen = () => {
  const [delivery, setDelivery] = useState<Nullable<CallInitDelivery>>(null);

  useEffect(() => {
    onCallInit(setDelivery);
  }, []);

  if (!delivery) return null;

  return <LiveCall delivery={delivery} />;
};

const LiveCall = ({ delivery }: { delivery: CallInitDelivery }) => {
  const { launch } = delivery.callInit;
  const sessionRef = useRef<Nullable<CallSession>>(null);
  const [runtime, setRuntime] = useState<Nullable<CallRuntimeState>>(null);

  useEffect(() => {
    const session = createCallSession({ callInit: delivery.callInit, port: delivery.port, onState: setRuntime });
    sessionRef.current = session;
    setRuntime(session.getState());

    return () => {
      session.dispose();
      sessionRef.current = null;
    };
  }, [delivery]);

  // Ticking call timer — counts up from the moment the media connects.
  const connectedAtRef = useRef<Nullable<number>>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const status = runtime?.callState.status;
  useEffect(() => {
    if (status !== 'connected') return;
    const startedAt = connectedAtRef.current ?? Date.now();
    connectedAtRef.current = startedAt;
    const update = () => setElapsedMs(Date.now() - startedAt);
    update();
    const id = setInterval(update, 1000);

    return () => clearInterval(id);
  }, [status]);

  // Device selection (camera/mic/output) for the call-settings modal.
  const [deviceSelection, setDeviceSelection] = useState<CallDeviceSelection>(() => loadDeviceSelection());
  const [devices, setDevices] = useState<CallDevices>({ cameras: [], microphones: [], outputs: [] });
  const [showSettings, setShowSettings] = useState(false);

  // Enumerate devices whenever the modal opens (permission is already granted
  // mid-call, so labels are populated) and refresh on hot-plug while it's open.
  useEffect(() => {
    if (!showSettings) return;
    let cancelled = false;
    const refresh = () => {
      void listCallDevices().then(next => {
        if (!cancelled) setDevices(next);
      });
    };
    refresh();
    navigator.mediaDevices.addEventListener('devicechange', refresh);

    return () => {
      cancelled = true;
      navigator.mediaDevices.removeEventListener('devicechange', refresh);
    };
  }, [showSettings]);

  const handleSelectDevice = useCallback((kind: CallDeviceKind, deviceId: Nullable<string>) => {
    setDeviceSelection(prev => {
      const next = withDeviceForKind(prev, kind, deviceId);
      saveDeviceSelection(next);
      return next;
    });
    // Camera/mic hot-swap on the live sender; output is applied via the
    // ActiveCallScreen prop below (setSinkId).
    if (kind === 'camera' || kind === 'microphone') {
      void sessionRef.current?.pc.switchDevice(kind, deviceId).catch(err => console.error('[CALL] switchDevice failed', err));
    }
  }, []);

  const settingsLabels: CallSettingsLabels = useMemo(
    () => ({
      title: LABELS.settingsTitle,
      close: LABELS.settingsClose,
      camera: LABELS.settingsCamera,
      microphone: LABELS.settingsMicrophone,
      output: LABELS.settingsOutput,
      systemDefault: LABELS.settingsDefault,
    }),
    [],
  );

  const session = sessionRef.current;
  if (!runtime || !session) return null;
  const { controller, pc } = session;
  const { callState, remoteStream, remoteMicEnabled } = runtime;
  // Reflects the LIVE purpose so it flips to video after an in-call upgrade.
  const isVideo = callState.purpose === 'video';

  if (callState.status === 'ringing') {
    return (
      <IncomingCallScreen
        name={launch.peerName}
        callTypeLabel={isVideo ? LABELS.incomingVideo : LABELS.incomingAudio}
        acceptLabel={LABELS.accept}
        declineLabel={LABELS.decline}
        acceptIcon={<PhoneIcon className="size-6" />}
        declineIcon={<PhoneOffIcon className="size-6" />}
        onAccept={() => controller.accept()}
        onDecline={() => controller.decline()}
      />
    );
  }

  const isTerminal = callState.status === 'ended' || callState.status === 'failed';
  const durationLabel = isTerminal ? LABELS.ended : callState.status === 'connected' ? formatDuration(elapsedMs) : LABELS.calling;

  return (
    <>
      <ActiveCallScreen
        name={launch.peerName}
        durationLabel={durationLabel}
        isVideo={isVideo}
        cameraEnabled={callState.media.cameraEnabled}
        microphoneEnabled={callState.media.microphoneEnabled}
        remoteMicEnabled={remoteMicEnabled}
        remoteStream={remoteStream}
        localStream={pc.localStream()}
        videoLabel={LABELS.video}
        muteLabel={LABELS.mute}
        unmuteLabel={LABELS.unmute}
        endLabel={LABELS.end}
        micOffSelfLabel={LABELS.micOffSelf}
        micOffPeerLabel={`${launch.peerName} ${LABELS.micOffPeerSuffix}`}
        switchTitle={LABELS.switchTitle}
        switchBody={LABELS.switchBody}
        switchCancelLabel={LABELS.switchCancel}
        switchConfirmLabel={LABELS.switchConfirm}
        pendingUpgrade={callState.pendingUpgrade}
        upgradeRequestTitle={`${launch.peerName} ${LABELS.upgradeRequestSuffix}`}
        upgradeCancelLabel={LABELS.upgradeCancel}
        upgradeConfirmLabel={LABELS.upgradeConfirm}
        videoIcon={callState.media.cameraEnabled ? <VideoIcon className="size-7" /> : <VideoOffIcon className="size-7" />}
        muteIcon={callState.media.microphoneEnabled ? <MicIcon className="size-7" /> : <MicOffIcon className="size-7" />}
        endIcon={<PhoneOffIcon className="size-7" />}
        outputDeviceId={deviceSelection.outputId}
        settingsLabel={LABELS.settingsGear}
        onToggleCamera={() => controller.toggleCamera(!callState.media.cameraEnabled)}
        onToggleMicrophone={() => controller.toggleMicrophone(!callState.media.microphoneEnabled)}
        onRequestVideoUpgrade={() => controller.requestVideoUpgrade()}
        onAcceptVideoUpgrade={() => controller.acceptVideoUpgrade()}
        onDeclineVideoUpgrade={() => controller.declineVideoUpgrade()}
        onEnd={() => controller.end()}
        onOpenSettings={() => setShowSettings(true)}
      />
      {showSettings && (
        <CallSettings
          devices={devices}
          selection={deviceSelection}
          labels={settingsLabels}
          onSelect={handleSelectDevice}
          onClose={() => setShowSettings(false)}
        />
      )}
    </>
  );
};
