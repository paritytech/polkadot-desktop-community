import { type ComponentType } from 'react';

import MonitorIcon from '@/shared/assets/images/icons/monitor.svg?jsx';
import MoonIcon from '@/shared/assets/images/icons/moon.svg?jsx';
import SunIcon from '@/shared/assets/images/icons/sun.svg?jsx';
import { SegmentedControl } from '@/shared/components';
import { useTranslation } from '@/shared/translation';
import { type ThemePreference, useSetThemePreference, useThemePreference } from '@/domains/application';

type Segment = { value: ThemePreference; labelKey: string; icon: ComponentType<{ className?: string }> };

const SEGMENTS: Segment[] = [
  { value: 'system', labelKey: 'feature.themeToggle.device', icon: MonitorIcon },
  { value: 'light', labelKey: 'feature.themeToggle.day', icon: SunIcon },
  { value: 'dark', labelKey: 'feature.themeToggle.night', icon: MoonIcon },
];

export const ColorModeControl = () => {
  const { t } = useTranslation();
  const preference = useThemePreference();
  const { run: setPreference } = useSetThemePreference();

  const handleChange = (value: string) => {
    const segment = SEGMENTS.find(item => item.value === value);
    if (segment) setPreference(segment.value);
  };

  return (
    <div className="flex">
      <SegmentedControl.Root label={t('feature.themeToggle.colorMode')} value={preference} onChange={handleChange}>
        {SEGMENTS.map(({ value, labelKey, icon: Icon }) => (
          <SegmentedControl.Item key={value} value={value}>
            <Icon className="size-3.5 shrink-0" />
            {t(labelKey)}
          </SegmentedControl.Item>
        ))}
      </SegmentedControl.Root>
    </div>
  );
};
