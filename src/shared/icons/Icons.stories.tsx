import { type Meta, type StoryObj } from '@storybook/react-vite';
import { type FC, type SVGProps } from 'react';

import { cnTw } from '@/shared/utils';

import * as icons from './index';

const iconSizes = ['12', '16', '20', '24', '28', '32'] as const;

type IconSize = (typeof iconSizes)[number];

const meta: Meta<{ size: IconSize }> = {
  title: 'Design System/Icons',
  parameters: {
    docs: {
      description: {
        component:
          'Every icon `@/shared/icons` exports: the `lucide-react` icons the app uses and the custom icons in `src/shared/icons/images`. Size and colour come from `className`.',
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

const entries: [string, FC<SVGProps<SVGSVGElement>>][] = Object.entries(icons).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

export const Set: Story = {
  args: { size: '16' },
  argTypes: {
    size: { control: 'select', options: iconSizes },
  },
  render: ({ size }) => (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(7rem,1fr))] gap-4">
      {entries.map(([name, Icon]) => (
        <div key={name} className="flex flex-col items-center gap-2 text-center">
          <Icon className={cnTw('text-fg-primary', iconSizeClass[size])} />
          <span className="text-2xs">{name}</span>
        </div>
      ))}
    </div>
  ),
};
