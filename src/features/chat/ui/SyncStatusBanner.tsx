import { RefreshCw } from 'lucide-react';

import AlertCircleIcon from '@/shared/assets/images/chat/alert-circle.svg?jsx';
import DevicePhoneMobileIcon from '@/shared/assets/images/chat/device-phone-mobile.svg?jsx';
import DevicePhoneUnsyncIcon from '@/shared/assets/images/chat/device-phone-unsync.svg?jsx';
import { isElectron } from '@/shared/env';
import { FEATURE_FLAGS } from '@/shared/featureFlags';
import { TEST_IDS } from '@/shared/test-ids';
import { useTranslation } from '@/shared/translation';
import { cnTw } from '@/shared/utils';
import { type DeviceSyncStatus, useDeviceSyncStatus } from '@/domains/device-sync';

/** The domain statuses that surface a banner; `'inactive'` renders nothing. */
type RenderedStatus = Exclude<DeviceSyncStatus, 'inactive'>;

type BannerCopy = {
  titleKey:
    | 'feature.chat.syncStatus.outOfSync.title'
    | 'feature.chat.syncStatus.syncing.title'
    | 'feature.chat.syncStatus.synced.title'
    | 'feature.chat.syncStatus.error.title';
  subtitleKey:
    | 'feature.chat.syncStatus.outOfSync.subtitle'
    | 'feature.chat.syncStatus.syncing.subtitle'
    | 'feature.chat.syncStatus.synced.subtitle'
    | 'feature.chat.syncStatus.error.subtitle';
};

const bannerCopy: Record<RenderedStatus, BannerCopy> = {
  stale: {
    titleKey: 'feature.chat.syncStatus.outOfSync.title',
    subtitleKey: 'feature.chat.syncStatus.outOfSync.subtitle',
  },
  syncing: {
    titleKey: 'feature.chat.syncStatus.syncing.title',
    subtitleKey: 'feature.chat.syncStatus.syncing.subtitle',
  },
  synced: {
    titleKey: 'feature.chat.syncStatus.synced.title',
    subtitleKey: 'feature.chat.syncStatus.synced.subtitle',
  },
  error: {
    titleKey: 'feature.chat.syncStatus.error.title',
    subtitleKey: 'feature.chat.syncStatus.error.subtitle',
  },
};

const iconClassName = cnTw('size-5 shrink-0 text-fg-primary');

const SyncStatusIcon = ({ status }: { status: RenderedStatus }) => {
  if (status === 'syncing') {
    return <RefreshCw aria-hidden className={cnTw(iconClassName, 'animate-spin')} />;
  }

  if (status === 'error') {
    return <AlertCircleIcon aria-hidden className={iconClassName} />;
  }

  if (status === 'synced') {
    return <DevicePhoneMobileIcon aria-hidden className={iconClassName} />;
  }

  return <DevicePhoneUnsyncIcon aria-hidden className={iconClassName} />;
};

export const SyncStatusBanner = () => {
  const { t } = useTranslation();
  const { data: status } = useDeviceSyncStatus();

  if (!FEATURE_FLAGS.deviceSync || !isElectron() || status === 'inactive') {
    return null;
  }

  const copy = bannerCopy[status];

  return (
    <div className="px-2 pb-2">
      <div
        className="flex items-center gap-2 rounded-lg border border-stroke-primary px-3 py-2"
        data-testid={TEST_IDS.chatSyncStatusBanner}
        data-sync-state={status}
      >
        <SyncStatusIcon status={status} />
        <div className="min-w-0 flex-1 text-start">
          <p className="text-sm font-medium text-fg-primary">{t(copy.titleKey)}</p>
          <p className="text-sm text-fg-secondary">{t(copy.subtitleKey)}</p>
        </div>
      </div>
    </div>
  );
};
