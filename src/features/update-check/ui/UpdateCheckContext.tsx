import { type PropsWithChildren, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { toast } from '@/shared/components';
import { useTranslation } from '@/shared/translation';
import {
  clearPendingVersion,
  getErrorMessage,
  getProgressPercent,
  getVersion,
  isVersionNewer,
  readDismissedVersion,
  readPendingVersion,
  writeDismissedVersion,
  writePendingVersion,
} from '../state/updateCheck';

import { type UpdateStatus, UpdateStatusModal } from './UpdateStatusModal';

const READY_TOAST_ID = 'update-ready';

type UpdateView = { status: UpdateStatus; progress?: number; errorMessage?: string };

// Single source of truth for mapping a main-process update event to the modal's view. Both the
// live manual-check handler and the "restore last result" path derive their view here, so the two
// can never drift (the same class of divergence bug the main-process gate consolidation fixes).
function deriveUpdateView(event: { type: string; data?: unknown }, errorFallback: string): UpdateView | null {
  switch (event.type) {
    case 'checking-for-update':
      return { status: 'checking' };
    case 'update-not-available':
      return { status: 'up-to-date', progress: 0 };
    case 'update-unsupported':
      return { status: 'unsupported' };
    case 'update-available':
      return { status: 'downloading', progress: 0 };
    case 'download-progress':
      return { status: 'downloading', progress: getProgressPercent(event.data) };
    case 'update-downloaded':
      return { status: 'ready-to-install', progress: 100 };
    case 'error':
      return { status: 'error', errorMessage: getErrorMessage(event.data, errorFallback) };
    default:
      return null;
  }
}

// The terminal results the modal can restore immediately on reopen instead of re-checking.
// Transient states (`checking-for-update`, `update-available`) and errors fall through to a fresh check.
const RESTORABLE_EVENT_TYPES = new Set(['update-not-available', 'update-unsupported', 'download-progress', 'update-downloaded']);

type UpdateCheckContextValue = {
  openUpdateCheck(): void;
};

const UpdateCheckContext = createContext<UpdateCheckContextValue>({
  openUpdateCheck: () => {
    throw new Error('UpdateCheckContext not provided');
  },
});

export const useUpdateCheck = () => useContext(UpdateCheckContext);

export const UpdateCheckProvider = ({ children }: PropsWithChildren) => {
  const { t } = useTranslation();

  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState<UpdateStatus>('idle');
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [currentVersion, setCurrentVersion] = useState('');

  const lastEventRef = useRef<{ type: string; data?: unknown } | null>(null);
  const isManualCheckRef = useRef(false);
  const isOpenRef = useRef(false);
  const didInitRef = useRef(false);
  // Set when the user asks to relaunch from the toast, so a subsequent install error surfaces
  // feedback (the background path stays silent for check failures the user didn't trigger).
  const relaunchRequestedRef = useRef(false);

  // The persistent "update ready — relaunch" reminder. It passes `onDismiss` so closing it
  // suppresses that version until a newer one arrives.
  const showReadyToast = useCallback(
    (version: string) => {
      toast.message({
        title: t('feature.updateCheck.updateAvailable'),
        id: READY_TOAST_ID,
        description: t('feature.updateCheck.updateAvailableHint', { version }),
        duration: Infinity,
        action: {
          label: t('feature.updateCheck.relaunch'),
          onClick: () => {
            relaunchRequestedRef.current = true;
            window.App?.quitAndInstall();
          },
        },
        onDismiss: () => writeDismissedVersion(version),
      });
    },
    [t],
  );

  const applyUpdateView = useCallback((view: UpdateView) => {
    setStatus(view.status);
    if (view.progress !== undefined) setDownloadProgress(view.progress);
    if (view.errorMessage !== undefined) setErrorMessage(view.errorMessage);
  }, []);

  const openUpdateCheck = useCallback(() => {
    if (!window.App?.checkForUpdates) return;

    isManualCheckRef.current = true;
    const lastEvent = lastEventRef.current;

    // If an auto-check already produced a terminal result before the modal was opened, restore it
    // immediately instead of triggering a fresh check.
    if (lastEvent && !isOpenRef.current && RESTORABLE_EVENT_TYPES.has(lastEvent.type)) {
      const view = deriveUpdateView(lastEvent, t('feature.updateCheck.error'));
      if (view) {
        setIsOpen(true);
        isOpenRef.current = true;
        setErrorMessage(undefined);
        applyUpdateView(view);
        return;
      }
    }

    setIsOpen(true);
    isOpenRef.current = true;
    setStatus('checking');
    setDownloadProgress(0);
    setErrorMessage(undefined);
    void window.App.checkForUpdates();
  }, [applyUpdateView, t]);

  const closeModal = useCallback(() => {
    setIsOpen(false);
    isOpenRef.current = false;
    setStatus('idle');
    setDownloadProgress(0);
    setErrorMessage(undefined);
    isManualCheckRef.current = false;
    lastEventRef.current = null;
    relaunchRequestedRef.current = false;
  }, []);

  const handleInstallNow = useCallback(() => {
    // No relaunch flag here: the modal path is a manual check, so an install failure already
    // surfaces through the modal's error state. The flag is only for the background toast path.
    window.App?.quitAndInstall();
  }, []);

  // "Later" (or closing) the ready modal: keep the update, but downgrade the prompt to the
  // persistent toast so the user is reminded without being blocked. An explicit "Later" re-arms the
  // reminder even for a version dismissed earlier — the user is deferring, not declining.
  const handleNotNow = useCallback(() => {
    const version = readPendingVersion();
    if (version) showReadyToast(version);
    closeModal();
  }, [closeModal, showReadyToast]);

  // One-time startup reconciliation: confirm a completed update and re-surface a still-pending one.
  useEffect(() => {
    if (didInitRef.current) return;
    if (typeof window === 'undefined' || !window.App?.getHostMetadata) return;
    didInitRef.current = true;

    void window.App.getHostMetadata().then(metadata => {
      const version = metadata.hostVersion;
      if (!version) return;
      setCurrentVersion(version);

      const pending = readPendingVersion();
      if (!pending) return;

      if (pending === version) {
        // The update we downloaded is now the running version — it landed. Confirm it once.
        // Tying the confirmation to a matching pending download avoids falsely announcing an
        // "update" on a manual downgrade or unrelated reinstall.
        clearPendingVersion();
        toast.success({
          title: t('feature.updateCheck.updated'),
          description: t('feature.updateCheck.updatedHint', { version }),
        });
      } else if (!isVersionNewer(pending, version)) {
        // Pending is stale: the running version already meets or exceeds it (updated out-of-band).
        // Drop it so we never prompt a relaunch into an older build.
        clearPendingVersion();
      }
      // If pending is strictly newer we leave it and do NOT re-prompt here: quitAndInstall can only
      // install a download staged in the current session. The updater's own startup re-check
      // re-emits an installable `update-downloaded`, which re-shows the reminder through the normal
      // (armed) background path.
    });
  }, [t]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.App?.onUpdateEvent) return;

    const unsubscribe = window.App.onUpdateEvent((event: { type: string; data?: unknown }) => {
      lastEventRef.current = event;

      // A completed download persists as pending regardless of who triggered the check, so the
      // relaunch reminder survives reloads. Derive the version once for both paths.
      const downloadedVersion = event.type === 'update-downloaded' ? getVersion(event.data) : null;
      if (downloadedVersion) writePendingVersion(downloadedVersion);

      if (isManualCheckRef.current) {
        const view = deriveUpdateView(event, t('feature.updateCheck.error'));
        if (view) applyUpdateView(view);
        return;
      }

      // Background (non-manual). A completed download surfaces as the persistent toast; a plain
      // check failure stays silent, but an error after the user asked to relaunch is surfaced so a
      // failed install isn't swallowed.
      if (event.type === 'update-downloaded') {
        if (!downloadedVersion) return;
        if (readDismissedVersion() === downloadedVersion) return;
        showReadyToast(downloadedVersion);
      } else if (event.type === 'error' && relaunchRequestedRef.current) {
        relaunchRequestedRef.current = false;
        toast.error({
          title: t('feature.updateCheck.error'),
          description: t('feature.updateCheck.errorHint'),
        });
      }
    });

    return () => {
      unsubscribe();
    };
  }, [applyUpdateView, showReadyToast, t]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.App?.onCheckForUpdatesRequest) return;

    const unsubscribe = window.App.onCheckForUpdatesRequest(openUpdateCheck);
    return () => {
      unsubscribe();
    };
  }, [openUpdateCheck]);

  const contextValue = useMemo(() => ({ openUpdateCheck }), [openUpdateCheck]);

  return (
    <UpdateCheckContext.Provider value={contextValue}>
      {children}
      <UpdateStatusModal
        currentVersion={currentVersion}
        downloadProgress={downloadProgress}
        errorMessage={errorMessage}
        isOpen={isOpen}
        status={status}
        onClose={closeModal}
        onInstallNow={handleInstallNow}
        onNotNow={handleNotNow}
      />
    </UpdateCheckContext.Provider>
  );
};
