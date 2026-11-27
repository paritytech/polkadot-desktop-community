import { type Meta, type StoryObj } from '@storybook/react-vite';
import { type FC, type SVGProps } from 'react';

import { cnTw } from '@/shared/utils';

import LastChatsIcon from './images/header/last-chats.svg?jsx';
import PolkadotHalfLogo from './images/polkadot-half-logo.svg?jsx';
import {
  ChatIcon,
  CoinIcon,
  DocumentsIcon,
  DollarIcon,
  LogoIcon,
  LogoIconSmall,
  MoneyIcon,
  ShoppingBagIcon,
  TicketIcon,
} from './index';

type IconSize = '12' | '16' | '20' | '24' | '28' | '32';

const meta: Meta<{ size: IconSize }> = {
  title: 'Design System/Icons',
  parameters: {
    docs: {
      description: {
        component:
          'The icon set in `src/shared/assets/images/icons`. Every icon is drawn on a 16 px grid as a 1.5 px `currentColor` line with round caps and joins and no fills. Anchors sit on quarter pixels, so lines stay crisp on 2x screens. `icons.spec.ts` enforces all of it.',
      },
    },
  },
};

export default meta;

type Story = StoryObj<{ size: IconSize }>;

const iconSizeClass: Record<IconSize, string> = {
  '12': cnTw('size-3'),
  '16': cnTw('size-4'),
  '20': cnTw('size-5'),
  '24': cnTw('size-6'),
  '28': cnTw('size-7'),
  '32': cnTw('size-8'),
};

const iconModules = import.meta.glob<FC<SVGProps<SVGSVGElement>>>('./images/icons/*.svg', {
  query: '?jsx',
  import: 'default',
  eager: true,
});

const icons = Object.entries(iconModules)
  .map(([path, Icon]) => ({ name: path.slice(path.lastIndexOf('/') + 1, -'.svg'.length), Icon }))
  .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

export const Set: Story = {
  args: { size: '16' },
  argTypes: {
    size: { control: 'select', options: ['12', '16', '20', '24', '28', '32'] satisfies IconSize[] },
  },
  render: ({ size }) => (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(7rem,1fr))] gap-4">
      {icons.map(({ name, Icon }) => (
        <div key={name} className="flex flex-col items-center gap-2 text-center">
          <Icon className={cnTw('text-fg-primary', iconSizeClass[size])} />
          <span className="text-2xs">{name}</span>
        </div>
      ))}
    </div>
  ),
};

const otherAssets: { name: string; Asset: FC<SVGProps<SVGSVGElement>> }[] = [
  { name: 'ChatIcon', Asset: ChatIcon },
  { name: 'CoinIcon', Asset: CoinIcon },
  { name: 'DocumentsIcon', Asset: DocumentsIcon },
  { name: 'DollarIcon', Asset: DollarIcon },
  { name: 'LogoIcon', Asset: LogoIcon },
  { name: 'LogoIconSmall', Asset: LogoIconSmall },
  { name: 'MoneyIcon', Asset: MoneyIcon },
  { name: 'ShoppingBagIcon', Asset: ShoppingBagIcon },
  { name: 'TicketIcon', Asset: TicketIcon },
  { name: 'polkadot-half-logo', Asset: PolkadotHalfLogo },
  { name: 'header/last-chats', Asset: LastChatsIcon },
];

export const OtherAssets: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg">Outside the icon set</h2>
      <div className="flex flex-wrap items-end gap-6">
        {otherAssets.map(({ name, Asset }) => (
          <div key={name} className="flex flex-col items-center gap-2 text-center">
            <Asset />
            <span className="text-2xs">{name}</span>
          </div>
        ))}
      </div>
    </div>
  ),
};
