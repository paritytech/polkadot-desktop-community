import { type StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(js|jsx|mts|ts|tsx)'],
  addons: ['@storybook/addon-links', '@storybook/addon-docs', '@storybook/addon-a11y'],
  framework: {
    name: '@storybook/react-vite',
    // The renderer's config has no default name, so Vite's lookup of `vite.config.*` finds nothing and
    // stories would build without the React, Tailwind and `@/` path setup.
    options: { builder: { viteConfigPath: 'vite.config.renderer.ts' } },
  },
};

export default config;
