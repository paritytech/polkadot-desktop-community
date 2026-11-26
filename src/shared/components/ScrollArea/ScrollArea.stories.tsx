import { type Meta, type StoryObj } from '@storybook/react-vite';

import { ScrollArea } from './ScrollArea';

const meta: Meta<typeof ScrollArea> = {
  component: ScrollArea,
  title: 'Design System/kit/ScrollArea',
};

export default meta;

type Story = StoryObj<typeof ScrollArea>;

export const Overflowing: Story = {
  render: args => (
    <div className="h-48 w-64 rounded-lg border border-chrome-text/10">
      <ScrollArea {...args}>
        {Array.from({ length: 30 }, (_, index) => (
          <p key={index} className="px-3 py-2 text-sm text-chrome-text">
            Row {index + 1}
          </p>
        ))}
      </ScrollArea>
    </div>
  ),
};
