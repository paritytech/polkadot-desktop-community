import {
  type LucideIcon,
  Bell,
  Bluetooth,
  Camera,
  Clipboard,
  ExternalLink,
  File,
  Fingerprint,
  Globe,
  IdCard,
  LayoutGrid,
  MapPin,
  Mic,
  Scan,
} from 'lucide-react';
import { type ReactNode, createElement } from 'react';

import { type PermissionId, type PermissionModality, type PermissionStatus, PERMISSION_IDS } from '@/domains/product';

import { type PermissionCategory, type PermissionMetadata } from './types';
import { PolkadotPermissionIcon } from './ui/PolkadotPermissionIcon';

const icon = (Icon: LucideIcon, size = 20) => createElement(Icon, { size });

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
    icon: icon(Clipboard),
    labelKey: 'feature.permissionSettings.permission.Clipboard.label',
    descriptionKey: 'feature.permissionSettings.permission.Clipboard.description',
    ruleKeys: ruleKeys('Clipboard', 4),
  },
  Microphone: {
    category: 'device',
    icon: icon(Mic),
    labelKey: 'feature.permissionSettings.permission.Microphone.label',
    descriptionKey: 'feature.permissionSettings.permission.Microphone.description',
    ruleKeys: ruleKeys('Microphone', 4),
  },
  Camera: {
    category: 'device',
    icon: icon(Camera),
    labelKey: 'feature.permissionSettings.permission.Camera.label',
    descriptionKey: 'feature.permissionSettings.permission.Camera.description',
    ruleKeys: ruleKeys('Camera', 4),
  },
  Notifications: {
    category: 'device',
    icon: icon(Bell),
    labelKey: 'feature.permissionSettings.permission.Notifications.label',
    descriptionKey: 'feature.permissionSettings.permission.Notifications.description',
    ruleKeys: ruleKeys('Notifications', 2),
  },
  Bluetooth: {
    category: 'device',
    icon: icon(Bluetooth),
    labelKey: 'feature.permissionSettings.permission.Bluetooth.label',
    descriptionKey: 'feature.permissionSettings.permission.Bluetooth.description',
    ruleKeys: ruleKeys('Bluetooth', 3),
  },
  Location: {
    category: 'device',
    icon: icon(MapPin),
    labelKey: 'feature.permissionSettings.permission.Location.label',
    descriptionKey: 'feature.permissionSettings.permission.Location.description',
    ruleKeys: ruleKeys('Location', 3),
  },
  Biometrics: {
    category: 'device',
    icon: icon(Fingerprint),
    labelKey: 'feature.permissionSettings.permission.Biometrics.label',
    descriptionKey: 'feature.permissionSettings.permission.Biometrics.description',
    ruleKeys: ruleKeys('Biometrics', 4),
  },
  OpenExternalUrl: {
    category: 'service',
    icon: icon(ExternalLink),
    labelKey: 'feature.permissionSettings.permission.OpenExternalUrl.label',
    descriptionKey: 'feature.permissionSettings.permission.OpenExternalUrl.description',
    ruleKeys: ruleKeys('OpenExternalUrl', 4),
  },
  ExternalRequest: {
    category: 'service',
    icon: icon(Globe),
    labelKey: 'feature.permissionSettings.permission.ExternalRequest.label',
    descriptionKey: 'feature.permissionSettings.permission.ExternalRequest.description',
    ruleKeys: ruleKeys('ExternalRequest', 4),
  },
  WebRtc: {
    category: 'service',
    icon: icon(Globe),
    labelKey: 'feature.permissionSettings.permission.WebRtc.label',
    descriptionKey: 'feature.permissionSettings.permission.WebRtc.description',
    ruleKeys: ruleKeys('WebRtc', 4),
  },
  ChainSubmit: {
    category: 'onchain',
    icon: createElement(PolkadotPermissionIcon, { size: 20 }),
    labelKey: 'feature.permissionSettings.permission.ChainSubmit.label',
    descriptionKey: 'feature.permissionSettings.permission.ChainSubmit.description',
    ruleKeys: ruleKeys('ChainSubmit', 4),
  },
  PreimageSubmit: {
    category: 'onchain',
    icon: createElement(PolkadotPermissionIcon, { size: 20 }),
    labelKey: 'feature.permissionSettings.permission.PreimageSubmit.label',
    descriptionKey: 'feature.permissionSettings.permission.PreimageSubmit.description',
    ruleKeys: ruleKeys('PreimageSubmit', 4),
  },
  StatementSubmit: {
    category: 'onchain',
    icon: createElement(PolkadotPermissionIcon, { size: 20 }),
    labelKey: 'feature.permissionSettings.permission.StatementSubmit.label',
    descriptionKey: 'feature.permissionSettings.permission.StatementSubmit.description',
    ruleKeys: ruleKeys('StatementSubmit', 4),
  },
  UserIdentity: {
    category: 'service',
    icon: icon(IdCard),
    labelKey: 'feature.permissionSettings.permission.UserIdentity.label',
    descriptionKey: 'feature.permissionSettings.permission.UserIdentity.description',
    ruleKeys: ruleKeys('UserIdentity', 4),
  },
  Files: {
    category: 'device',
    icon: icon(File),
    labelKey: 'feature.permissionSettings.permission.Files.label',
    descriptionKey: 'feature.permissionSettings.permission.Files.description',
    ruleKeys: ruleKeys('Files', 4),
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

export type ModalityMetadata = {
  id: PermissionModality;
  icon: ReactNode;
  labelKey: string;
  descriptionKey: string;
};

const MODALITY_METADATA_BY_ID = {
  app: {
    icon: icon(Scan),
    labelKey: 'widget.permission.modality.app.label',
    descriptionKey: 'widget.permission.modality.app.description',
  },
  widget: {
    icon: icon(LayoutGrid),
    labelKey: 'widget.permission.modality.widget.label',
    descriptionKey: 'widget.permission.modality.widget.description',
  },
} satisfies Record<PermissionModality, Omit<ModalityMetadata, 'id'>>;

export const getModalityMeta = (id: PermissionModality): ModalityMetadata => ({ id, ...MODALITY_METADATA_BY_ID[id] });
