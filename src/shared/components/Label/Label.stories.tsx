import { type Meta, type StoryObj } from '@storybook/react-vite';

import { Input } from '../Input/Input';

import { Label } from './Label';

const meta: Meta<typeof Label> = {
  component: Label,
  title: 'Design System/kit/Label',
  args: { htmlFor: 'label-story-input', children: 'Address' },
};

export default meta;

type Story = StoryObj<typeof Label>;

export const WithInput: Story = {
  render: args => (
    <div className="flex w-64 flex-col gap-1">
      <Label {...args} />
      <Input id={args.htmlFor} placeholder="dot.li" />
    </div>
  ),
};
