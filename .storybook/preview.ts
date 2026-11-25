import { type Preview } from '@storybook/react-vite';

// eslint-disable-next-line local-rules/no-relative-import-from-root -- storybook preview lives outside src/
import '../src/index.css';

const preview: Preview = {
  parameters: {
    layout: 'fullscreen',
    backgrounds: {
      default: 'surface-main',
      values: [
        { name: 'surface-main', value: 'var(--bg-surface-main)' },
        { name: 'surface-container', value: 'var(--bg-surface-container)' },
      ],
    },
  },
};

export default preview;
