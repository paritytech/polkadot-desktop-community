import { type FC, type SVGProps, createElement } from 'react';

import BellIcon from '@/shared/assets/images/icons/bell.svg?jsx';
import BlocksIcon from '@/shared/assets/images/icons/blocks.svg?jsx';
import BluetoothIcon from '@/shared/assets/images/icons/bluetooth.svg?jsx';
import CameraIcon from '@/shared/assets/images/icons/camera.svg?jsx';
import ClipboardIcon from '@/shared/assets/images/icons/clipboard.svg?jsx';
import ExternalLinkIcon from '@/shared/assets/images/icons/external-link.svg?jsx';
import FileUpIcon from '@/shared/assets/images/icons/file-up.svg?jsx';
import FingerprintPatternIcon from '@/shared/assets/images/icons/fingerprint-pattern.svg?jsx';
import GlobeIcon from '@/shared/assets/images/icons/globe.svg?jsx';
import IdCardIcon from '@/shared/assets/images/icons/id-card.svg?jsx';
import MapPinIcon from '@/shared/assets/images/icons/map-pin.svg?jsx';
import MessageSquareTextIcon from '@/shared/assets/images/icons/message-square-text.svg?jsx';
import MicIcon from '@/shared/assets/images/icons/mic.svg?jsx';
import Move3dIcon from '@/shared/assets/images/icons/move-3d.svg?jsx';
import WalletIcon from '@/shared/assets/images/icons/wallet.svg?jsx';
import { cnTw } from '@/shared/utils';
import { type PermissionId, type PermissionStatus, PERMISSION_IDS } from '@/domains/product';

import { type PermissionCategory, type PermissionMetadata } from './types';

function icon(Icon: FC<SVGProps<SVGSVGElement>>) {
  return createElement(Icon, { className: cnTw('size-5') });
}

const ruleKeys = (id: string, count: number) =>
  Array.from({ length: count }, (_, i) => `feature.permissionSettings.permission.${id}.rule.${i + 1}`);

// Presentational metadata keyed by the domain's canonical PermissionId. The
// `satisfies Record<PermissionId, …>` makes totality a compile error: every
// PERMISSION_ID must have an entry here (and no extras), so `getPermissionMeta`
// is total over the domain taxonomy and the routability guarantee in
// ProductContainerBinding holds.
const PERMISSION_METADATA_BY_ID = {
  Clipboard: {
    category: 'device',
    icon: icon(ClipboardIcon),
    labelKey: 'feature.permissionSettings.permission.Clipboard.label',
    descriptionKey: 'feature.permissionSettings.permission.Clipboard.description',
    ruleKeys: ruleKeys('Clipboard', 4),
  },
  Microphone: {
    category: 'device',
    icon: icon(MicIcon),
    labelKey: 'feature.permissionSettings.permission.Microphone.label',
    descriptionKey: 'feature.permissionSettings.permission.Microphone.description',
    ruleKeys: ruleKeys('Microphone', 4),
  },
  Camera: {
    category: 'device',
    icon: icon(CameraIcon),
    labelKey: 'feature.permissionSettings.permission.Camera.label',
    descriptionKey: 'feature.permissionSettings.permission.Camera.description',
    ruleKeys: ruleKeys('Camera', 4),
  },
  Notifications: {
    category: 'device',
    icon: icon(BellIcon),
    labelKey: 'feature.permissionSettings.permission.Notifications.label',
    descriptionKey: 'feature.permissionSettings.permission.Notifications.description',
    ruleKeys: ruleKeys('Notifications', 2),
  },
  Bluetooth: {
    category: 'device',
    icon: icon(BluetoothIcon),
    labelKey: 'feature.permissionSettings.permission.Bluetooth.label',
    descriptionKey: 'feature.permissionSettings.permission.Bluetooth.description',
    ruleKeys: ruleKeys('Bluetooth', 3),
  },
  Location: {
    category: 'device',
    icon: icon(MapPinIcon),
    labelKey: 'feature.permissionSettings.permission.Location.label',
    descriptionKey: 'feature.permissionSettings.permission.Location.description',
    ruleKeys: ruleKeys('Location', 3),
  },
  Biometrics: {
    category: 'device',
    icon: icon(FingerprintPatternIcon),
    labelKey: 'feature.permissionSettings.permission.Biometrics.label',
    descriptionKey: 'feature.permissionSettings.permission.Biometrics.description',
    ruleKeys: ruleKeys('Biometrics', 4),
  },
  Motion: {
    category: 'device',
    icon: icon(Move3dIcon),
    labelKey: 'feature.permissionSettings.permission.Motion.label',
    descriptionKey: 'feature.permissionSettings.permission.Motion.description',
    ruleKeys: ruleKeys('Motion', 3),
  },
  OpenExternalUrl: {
    category: 'service',
    icon: icon(ExternalLinkIcon),
    labelKey: 'feature.permissionSettings.permission.OpenExternalUrl.label',
    descriptionKey: 'feature.permissionSettings.permission.OpenExternalUrl.description',
    ruleKeys: ruleKeys('OpenExternalUrl', 4),
  },
  ExternalRequest: {
    category: 'service',
    icon: icon(GlobeIcon),
    labelKey: 'feature.permissionSettings.permission.ExternalRequest.label',
    descriptionKey: 'feature.permissionSettings.permission.ExternalRequest.description',
    ruleKeys: ruleKeys('ExternalRequest', 4),
  },
  WebRtc: {
    category: 'service',
    icon: icon(GlobeIcon),
    labelKey: 'feature.permissionSettings.permission.WebRtc.label',
    descriptionKey: 'feature.permissionSettings.permission.WebRtc.description',
    ruleKeys: ruleKeys('WebRtc', 4),
  },
  ChainSubmit: {
    category: 'onchain',
    icon: icon(BlocksIcon),
    labelKey: 'feature.permissionSettings.permission.ChainSubmit.label',
    descriptionKey: 'feature.permissionSettings.permission.ChainSubmit.description',
    ruleKeys: ruleKeys('ChainSubmit', 4),
  },
  PreimageSubmit: {
    category: 'onchain',
    icon: icon(FileUpIcon),
    labelKey: 'feature.permissionSettings.permission.PreimageSubmit.label',
    descriptionKey: 'feature.permissionSettings.permission.PreimageSubmit.description',
    ruleKeys: ruleKeys('PreimageSubmit', 4),
  },
  StatementSubmit: {
    category: 'onchain',
    icon: icon(MessageSquareTextIcon),
    labelKey: 'feature.permissionSettings.permission.StatementSubmit.label',
    descriptionKey: 'feature.permissionSettings.permission.StatementSubmit.description',
    ruleKeys: ruleKeys('StatementSubmit', 4),
  },
  BalanceAccess: {
    category: 'onchain',
    icon: icon(WalletIcon),
    labelKey: 'feature.permissionSettings.permission.BalanceAccess.label',
    descriptionKey: 'feature.permissionSettings.permission.BalanceAccess.description',
    ruleKeys: ruleKeys('BalanceAccess', 4),
  },
  UserIdentity: {
    category: 'service',
    icon: icon(IdCardIcon),
    labelKey: 'feature.permissionSettings.permission.UserIdentity.label',
    descriptionKey: 'feature.permissionSettings.permission.UserIdentity.description',
    ruleKeys: ruleKeys('UserIdentity', 4),
  },
} satisfies Record<PermissionId, Omit<PermissionMetadata, 'id'>>;

// Derived in PERMISSION_IDS order so the domain taxonomy is the single source of
// both membership and display order.
export const PERMISSION_METADATA: PermissionMetadata[] = PERMISSION_IDS.map(id => ({
  id,
  ...PERMISSION_METADATA_BY_ID[id],
}));

export const PERMISSION_CATEGORIES: readonly { key: PermissionCategory; labelKey: string }[] = [
  { key: 'device', labelKey: 'feature.permissionSettings.category.device' },
  { key: 'onchain', labelKey: 'feature.permissionSettings.category.onchain' },
  { key: 'service', labelKey: 'feature.permissionSettings.category.service' },
];

export const STATUS_LABEL_KEYS: Record<PermissionStatus, string> = {
  ask: 'feature.permissionSettings.status.ask',
  granted: 'feature.permissionSettings.status.granted',
  denied: 'feature.permissionSettings.status.denied',
};

export const getPermissionMeta = (id: string): PermissionMetadata | undefined => PERMISSION_METADATA.find(p => p.id === id);
