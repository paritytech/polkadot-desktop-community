import { type Meta, type StoryObj } from '@storybook/react-vite';

import { Button } from '../Button/Button';

import { DropdownMenu } from './DropdownMenu';

const meta: Meta<typeof DropdownMenu.Root> = {
  component: DropdownMenu.Root,
  title: 'Design System/kit/DropdownMenu',
};

export default meta;

type Story = StoryObj<typeof DropdownMenu.Root>;

export const Default: Story = {
  render: args => (
    <DropdownMenu.Root {...args}>
      <DropdownMenu.Trigger asChild>
        <Button>Open menu</Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content>
        <DropdownMenu.Item>Rename</DropdownMenu.Item>
        <DropdownMenu.Item>Duplicate</DropdownMenu.Item>
        <DropdownMenu.Item disabled>Archive</DropdownMenu.Item>
        <DropdownMenu.Separator />
        <DropdownMenu.Item variant="danger">Delete</DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  ),
};

export const Open: Story = {
  ...Default,
  args: { defaultOpen: true },
  decorators: [
    Story => (
      <div className="pb-48">
        <Story />
      </div>
    ),
  ],
};
