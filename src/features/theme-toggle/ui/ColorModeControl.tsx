import { Monitor, Moon, Sun } from 'lucide-react';
import { type ComponentType } from 'react';

import { SegmentedControl } from '@/shared/components';
import { useTranslation } from '@/shared/translation';
import { type ThemePreference, useSetThemePreference, useThemePreference } from '@/domains/application';

type Segment = { value: ThemePreference; labelKey: string; icon: ComponentType<{ className?: string }> };

const SEGMENTS: Segment[] = [
  { value: 'system', labelKey: 'feature.themeToggle.device', icon: Monitor },
  { value: 'light', labelKey: 'feature.themeToggle.day', icon: Sun },
  { value: 'dark', labelKey: 'feature.themeToggle.night', icon: Moon },
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
