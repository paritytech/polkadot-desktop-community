import { type Meta, type StoryObj } from '@storybook/react-vite';

import { ContextMenu } from './ContextMenu';

const meta: Meta<typeof ContextMenu.Root> = {
  component: ContextMenu.Root,
  title: 'Design System/kit/ContextMenu',
};

export default meta;

type Story = StoryObj<typeof ContextMenu.Root>;

export const Default: Story = {
  render: args => (
    <ContextMenu.Root {...args}>
      <ContextMenu.Trigger asChild>
        <div className="flex h-48 w-96 items-center justify-center rounded-lg border border-dashed border-chrome-line text-sm text-chrome-text">
          Right-click this region
        </div>
      </ContextMenu.Trigger>
      <ContextMenu.Content>
        <ContextMenu.Item>Copy link</ContextMenu.Item>
        <ContextMenu.Item>Open in new tab</ContextMenu.Item>
        <ContextMenu.Item disabled>Pin</ContextMenu.Item>
        <ContextMenu.Separator />
        <ContextMenu.Item variant="danger">Remove</ContextMenu.Item>
      </ContextMenu.Content>
    </ContextMenu.Root>
  ),
};
