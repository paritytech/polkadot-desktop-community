import { type Preview } from '@storybook/react-vite';
import { type PropsWithChildren, useEffect } from 'react';

import { type Locale, TranslationProvider } from '@/shared/translation';

// eslint-disable-next-line local-rules/no-relative-import-from-root -- storybook preview lives outside src/
import '../src/index.css';

type Mode = 'light' | 'dark';

// Listed here rather than imported from the application domain so the preview loads no domain code.
type Palette = 'berlin' | 'tokyo' | 'lisbon' | 'malta';

type StoryThemeProps = PropsWithChildren<{
  mode: Mode;
  palette: Palette;
  locale: Locale;
}>;

const StoryTheme = ({ mode, palette, locale, children }: StoryThemeProps) => {
  useEffect(() => {
    const root = document.documentElement;

    root.classList.toggle('dark', mode === 'dark');
    root.style.colorScheme = mode;
    root.dataset['theme'] = palette;
  }, [mode, palette]);

  return (
    <TranslationProvider locale={locale}>
      <div className="min-h-screen bg-bg-surface-main p-6 text-chrome-text">{children}</div>
    </TranslationProvider>
  );
};

const preview: Preview = {
  parameters: {
    layout: 'fullscreen',
  },
  globalTypes: {
    mode: {
      description: 'Light or dark mode',
      toolbar: {
        title: 'Mode',
        icon: 'mirror',
        items: [
          { value: 'light', title: 'Light' },
          { value: 'dark', title: 'Dark' },
        ],
        dynamicTitle: true,
      },
    },
    palette: {
      description: 'Colour palette',
      toolbar: {
        title: 'Palette',
        icon: 'paintbrush',
        items: [
          { value: 'berlin', title: 'Berlin' },
          { value: 'tokyo', title: 'Tokyo' },
          { value: 'lisbon', title: 'Lisbon' },
          { value: 'malta', title: 'Malta' },
        ],
        dynamicTitle: true,
      },
    },
    locale: {
      description: 'Locale',
      toolbar: {
        title: 'Locale',
        icon: 'globe',
        items: [
          { value: 'en', title: 'English' },
          { value: 'ar', title: 'Arabic' },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: {
    mode: 'light',
    palette: 'berlin',
    locale: 'en',
  },
  decorators: [
    (Story, { globals }) => (
      <StoryTheme mode={globals['mode']} palette={globals['palette']} locale={globals['locale']}>
        <Story />
      </StoryTheme>
    ),
  ],
};

export default preview;
