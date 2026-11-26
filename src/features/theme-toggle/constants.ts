import { type ThemeName } from '@/domains/application';

// Each palette as it renders: its light-mode --chrome-bottom and dark-mode --chrome-top from src/shared/theme/chrome.css. The picker shows all four palettes at once, so it cannot read their tokens; change these with chrome.css.
export const THEME_SWATCHES: Record<ThemeName, { light: string; dark: string }> = {
  berlin: { light: '#fafafb', dark: '#2c2e34' },
  tokyo: { light: '#fff0f1', dark: '#2b2533' },
  lisbon: { light: '#fff7eb', dark: '#302a24' },
  malta: { light: '#eafef4', dark: '#2a322f' },
};
