import { type Config } from 'tailwindcss';
import animatePlugin from 'tailwindcss-animate';

const tailwindConfig: Config = {
  content: ['./src/**/*.{html,ts,tsx}'],
  darkMode: 'class',
  plugins: [animatePlugin],
};

export default tailwindConfig;
