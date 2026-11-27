import { createFeature } from '@/shared/feature';
import { persistentSlot, topBarLeadingSlot } from '@/features/app-shell';
import { tabContentSlot } from '@/features/browser';

import { SETTINGS } from './tabs';
import { SettingsNavigationButtons } from './ui/SettingsNavigationButtons';
import { SettingsTabBinding } from './ui/SettingsTabBinding';
import { SettingsTabContent } from './ui/SettingsTabContent';

export const settingsFeature = createFeature({
  name: 'browser/settings',
});

settingsFeature.inject(topBarLeadingSlot, { order: 1, render: () => <SettingsNavigationButtons /> });
settingsFeature.inject(tabContentSlot, ({ tab, isActive }) =>
  tab.type === SETTINGS ? <SettingsTabContent isActive={isActive} /> : null,
);
settingsFeature.inject(persistentSlot, () => <SettingsTabBinding />);
