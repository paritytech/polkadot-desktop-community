import { type Meta, type StoryObj } from '@storybook/react-vite';
import { type FC, type SVGProps } from 'react';

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

const meta: Meta = {
  title: 'Design System/Assets',
  parameters: {
    docs: {
      description: {
        component: 'Brand marks and graphics in `src/shared/assets/images`. UI icons are in `@/shared/icons`.',
      },
    },
  },
};

export default meta;

type Story = StoryObj;

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
      <h2 className="text-lg">Brand marks and graphics</h2>
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
