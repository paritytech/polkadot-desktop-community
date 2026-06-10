import { type ReactNode } from 'react';

import ThemeDarkPreview from '@/shared/assets/images/theme-dark.svg?jsx';
import ThemeLightPreview from '@/shared/assets/images/theme-light.svg?jsx';
import ThemeSystemPreview from '@/shared/assets/images/theme-system.svg?jsx';
import { SettingsList } from '@/shared/components';
import { type ThemePreference, saveTheme, useThemePreference } from '@/shared/hooks';
import { useTranslation } from '@/shared/translation';
import { cnTw } from '@/shared/utils';

export const ThemeSettings = () => {
  const { t } = useTranslation();
  const preference = useThemePreference();

  return (
    <SettingsList title={t('feature.themeToggle.title')} subtitle={t('feature.themeToggle.description')}>
      <h2 className="pb-2 text-sm leading-5 font-semibold text-fg-primary">{t('feature.themeToggle.appearance')}</h2>
      <div className="flex gap-4">
        <ThemeCard
          label={t('feature.themeToggle.system')}
          value="system"
          active={preference === 'system'}
          preview={<ThemeSystemPreview className="size-full" preserveAspectRatio="xMidYMid slice" />}
          onSelect={saveTheme}
        />
        <ThemeCard
          label={t('feature.themeToggle.light')}
          value="light"
          active={preference === 'light'}
          preview={<ThemeLightPreview className="size-full" preserveAspectRatio="xMidYMid slice" />}
          onSelect={saveTheme}
        />
        <ThemeCard
          label={t('feature.themeToggle.dark')}
          value="dark"
          active={preference === 'dark'}
          preview={<ThemeDarkPreview className="size-full" preserveAspectRatio="xMidYMid slice" />}
          onSelect={saveTheme}
        />
      </div>
    </SettingsList>
  );
};

type ThemeCardProps = {
  label: string;
  value: ThemePreference;
  active: boolean;
  preview: ReactNode;
  onSelect: (value: ThemePreference) => void;
};

const ThemeCard = ({ label, value, active, preview, onSelect }: ThemeCardProps) => {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      aria-label={label}
      className={cnTw(
        'flex min-w-0 flex-1 flex-col items-start rounded-lg border bg-surface-foreground text-left transition-colors',
        'focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
        active ? 'border-text-primary' : 'border-general-border hover:border-text-secondary/40',
      )}
      onClick={() => onSelect(value)}
    >
      <div aria-hidden className="relative h-[158px] w-full overflow-hidden rounded-t-lg border-b border-general-border">
        {preview}
      </div>
      <div className="flex w-full items-center justify-center gap-2 p-3">
        <span aria-hidden className="min-w-0 flex-1 truncate text-sm leading-5 font-semibold text-text-primary">
          {label}
        </span>
        <RadioIndicator checked={active} />
      </div>
    </button>
  );
};

const RadioIndicator = ({ checked }: { checked: boolean }) => (
  <span
    aria-hidden
    className={cnTw(
      'relative inline-flex size-4 shrink-0 items-center justify-center rounded-full border',
      checked ? 'border-transparent bg-primary' : 'border-general-border bg-surface-foreground',
    )}
  >
    {checked && <span className="block size-2 rounded-full bg-primary-foreground" />}
  </span>
);
