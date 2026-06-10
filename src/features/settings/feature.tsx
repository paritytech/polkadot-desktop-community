import { createFeature } from '@/shared/feature';
import { persistentSlot, topBarLeadingSlot } from '@/features/app-shell';
import { tabContentSlot, tabHoverSlot } from '@/features/browser';

import { SETTINGS } from './tabs';
import { SettingsNavigationButtons } from './ui/SettingsNavigationButtons';
import { SettingsTabBinding } from './ui/SettingsTabBinding';
import { SettingsTabContent } from './ui/SettingsTabContent';
import { SettingsTabHover } from './ui/SettingsTabHover';

export const settingsFeature = createFeature({
  name: 'browser/settings',
});

settingsFeature.inject(topBarLeadingSlot, { order: 1, render: () => <SettingsNavigationButtons /> });
settingsFeature.inject(tabContentSlot, ({ tab, isActive }) =>
  tab.type === SETTINGS ? <SettingsTabContent isActive={isActive} /> : null,
);
settingsFeature.inject(tabHoverSlot, ({ tab }) => (tab.type === SETTINGS ? <SettingsTabHover /> : null));
settingsFeature.inject(persistentSlot, () => <SettingsTabBinding />);
