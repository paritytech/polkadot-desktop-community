import trUiPreset from '@novasamatech/tr-ui/tailwind.preset';
import { type Config } from 'tailwindcss';
import animatePlugin from 'tailwindcss-animate';

const tailwindConfig: Config = {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  presets: [trUiPreset as Config],
  content: ['./src/**/*.{html,ts,tsx}'],
  darkMode: 'class',
  plugins: [animatePlugin],
};

export default tailwindConfig;
