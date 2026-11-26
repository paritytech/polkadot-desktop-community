import { type Meta, type StoryObj } from '@storybook/react-vite';
import { SettingsIcon } from 'lucide-react';

import { IconButton } from '../IconButton/IconButton';

import { Tooltip } from './Tooltip';

const meta: Meta<typeof Tooltip.Root> = {
  component: Tooltip.Root,
  title: 'Design System/kit/Tooltip',
};

export default meta;

type Story = StoryObj<typeof Tooltip.Root>;

export const Default: Story = {
  render: args => (
    <Tooltip.Provider>
      <Tooltip.Root {...args}>
        <Tooltip.Trigger asChild>
          <IconButton label="Settings">
            <SettingsIcon />
          </IconButton>
        </Tooltip.Trigger>
        <Tooltip.Content>Settings</Tooltip.Content>
      </Tooltip.Root>
    </Tooltip.Provider>
  ),
};

export const Open: Story = {
  ...Default,
  args: { defaultOpen: true },
  decorators: [
    Story => (
      <div className="pt-16">
        <Story />
      </div>
    ),
  ],
};
