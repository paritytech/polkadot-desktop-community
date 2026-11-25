import { type ThemeName } from '@/domains/application';

// Each palette's signature colour for its swatch: the theme picker shows every palette at once, so it cannot read the
// active palette's tokens.
export const THEME_SWATCH_COLORS: Record<ThemeName, string> = {
  berlin: '#0b0c0f',
  tokyo: '#9f1239',
  lisbon: '#d96c21',
  malta: '#065f46',
};
