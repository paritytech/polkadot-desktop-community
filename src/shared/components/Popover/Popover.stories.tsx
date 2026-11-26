import { type Meta, type StoryObj } from '@storybook/react-vite';

import { Button } from '../Button/Button';

import { Popover } from './Popover';

const meta: Meta<typeof Popover.Root> = {
  component: Popover.Root,
  title: 'Design System/kit/Popover',
};

export default meta;

type Story = StoryObj<typeof Popover.Root>;

export const Default: Story = {
  render: args => (
    <Popover.Root {...args}>
      <Popover.Trigger asChild>
        <Button>Open popover</Button>
      </Popover.Trigger>
      <Popover.Content>
        <p className="w-64 p-4 text-sm text-chrome-text">Popover content floats on the shared surface.</p>
      </Popover.Content>
    </Popover.Root>
  ),
};

export const Open: Story = {
  ...Default,
  args: { defaultOpen: true },
  decorators: [
    Story => (
      <div className="pb-32">
        <Story />
      </div>
    ),
  ],
};
