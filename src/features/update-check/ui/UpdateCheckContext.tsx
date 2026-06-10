import { type PropsWithChildren, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { useTranslation } from '@/shared/translation';
import {
  getErrorMessage,
  getProgressPercent,
  getVersion,
  readDismissedVersion,
  writeDismissedVersion,
} from '../state/updateCheck';

import { type UpdateStatus, UpdateStatusModal } from './UpdateStatusModal';
import { type ToastStatus, UpdateToast } from './UpdateToast';

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
  const lastEventRef = useRef<{ type: string; data?: unknown } | null>(null);

  const [toastVersion, setToastVersion] = useState('');
  const [toastStatus, setToastStatus] = useState<ToastStatus>('ready');

  const isManualCheckRef = useRef(false);
  const isOpenRef = useRef(false);
  const toastVisibleRef = useRef(false);

  const openUpdateCheck = useCallback(() => {
    if (!window.App?.isAutoUpdateSupported) return;

    isManualCheckRef.current = true;
    const lastEvent = lastEventRef.current;

    // If an auto-check already completed before the modal was opened,
    // restore its result immediately instead of triggering a new check.
    if (lastEvent && !isOpenRef.current) {
      setIsOpen(true);
      isOpenRef.current = true;
      setErrorMessage(undefined);

      switch (lastEvent.type) {
        case 'update-not-available':
          setStatus('up-to-date');
          setDownloadProgress(0);
          return;
        case 'download-progress':
          setStatus('downloading');
          setDownloadProgress(getProgressPercent(lastEvent.data));
          return;
        case 'update-downloaded':
          setStatus('ready-to-install');
          setDownloadProgress(100);
          return;
        default:
          break;
      }
    }

    setIsOpen(true);
    isOpenRef.current = true;
    setStatus('checking');
    setDownloadProgress(0);
    setErrorMessage(undefined);
    void window.App.checkForUpdates();
  }, []);

  const closeModal = useCallback(() => {
    setIsOpen(false);
    isOpenRef.current = false;
    setStatus('idle');
    setDownloadProgress(0);
    setErrorMessage(undefined);
    isManualCheckRef.current = false;
    lastEventRef.current = null;
  }, []);

  const handleInstallNow = useCallback(() => {
    window.App?.quitAndInstall();
  }, []);

  const handleToastDismiss = useCallback(() => {
    const version = toastVersionRef.current;
    if (version) {
      writeDismissedVersion(version);
    }
    setToastVersion('');
    toastVisibleRef.current = false;
  }, []);

  const handleToastInstall = useCallback(() => {
    setToastStatus('installing');
    window.App?.quitAndInstall();
  }, []);

  const toastVersionRef = useRef('');
  toastVersionRef.current = toastVersion;

  useEffect(() => {
    if (typeof window === 'undefined' || !window.App?.onUpdateEvent) return;

    const unsubscribe = window.App.onUpdateEvent((event: { type: string; data?: unknown }) => {
      lastEventRef.current = event;

      if (isManualCheckRef.current) {
        switch (event.type) {
          case 'checking-for-update':
            setStatus('checking');
            break;
          case 'update-not-available':
            setStatus('up-to-date');
            break;
          case 'update-available':
            setStatus('downloading');
            setDownloadProgress(0);
            break;
          case 'download-progress':
            setStatus('downloading');
            setDownloadProgress(getProgressPercent(event.data));
            break;
          case 'update-downloaded':
            setStatus('ready-to-install');
            setDownloadProgress(100);
            break;
          case 'error':
            setStatus('error');
            setErrorMessage(getErrorMessage(event.data, t('feature.updateCheck.error')));
            break;
          default:
            break;
        }
        return;
      }

      if (event.type === 'update-downloaded') {
        const version = getVersion(event.data);
        if (!version) return;

        if (readDismissedVersion() === version) return;
        setToastVersion(version);
        setToastStatus('ready');
        toastVisibleRef.current = true;
      }

      if (event.type === 'error' && toastVisibleRef.current) {
        setToastStatus('error');
      }
    });

    return () => {
      unsubscribe();
    };
  }, [t]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.App?.onCheckForUpdatesRequest) return;

    const unsubscribe = window.App.onCheckForUpdatesRequest(openUpdateCheck);
    return () => {
      unsubscribe();
    };
  }, [openUpdateCheck]);

  const contextValue = useMemo(() => ({ openUpdateCheck }), [openUpdateCheck]);

  const toastVisible = toastVersion !== '';

  return (
    <UpdateCheckContext.Provider value={contextValue}>
      {children}
      <UpdateStatusModal
        downloadProgress={downloadProgress}
        errorMessage={errorMessage}
        isOpen={isOpen}
        status={status}
        onClose={closeModal}
        onInstallNow={handleInstallNow}
        onNotNow={closeModal}
      />
      <UpdateToast
        status={toastStatus}
        version={toastVersion}
        visible={toastVisible}
        onDismiss={handleToastDismiss}
        onInstall={handleToastInstall}
      />
    </UpdateCheckContext.Provider>
  );
};
