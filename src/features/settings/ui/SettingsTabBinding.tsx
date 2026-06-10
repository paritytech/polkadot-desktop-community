import { useTabRouteBinding } from '@/aggregates/browser-tabs';
import { SETTINGS } from '../tabs';

const settingsTab = { id: SETTINGS, type: SETTINGS, deeplink: '' };

export const SettingsTabBinding = () => {
  useTabRouteBinding({ segment: '/settings', tab: settingsTab, touchAlive: true });

  return null;
};
