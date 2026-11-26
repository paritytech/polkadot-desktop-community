import { type Meta, type StoryObj } from '@storybook/react-vite';

import { Badge } from './Badge';

const meta: Meta<typeof Badge> = {
  component: Badge,
  title: 'Design System/kit/Badge',
  args: { children: 'Beta' },
};

export default meta;

type Story = StoryObj<typeof Badge>;

export const Default: Story = {};
