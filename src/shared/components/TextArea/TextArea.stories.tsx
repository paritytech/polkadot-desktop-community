import { type Meta, type StoryObj } from '@storybook/react-vite';
import { SendIcon } from 'lucide-react';

import { IconButton } from '../IconButton/IconButton';

import { TextArea } from './TextArea';

const meta: Meta<typeof TextArea> = {
  component: TextArea,
  title: 'Design System/kit/TextArea',
  args: { placeholder: 'Message' },
};

export default meta;

type Story = StoryObj<typeof TextArea>;

export const Empty: Story = {};

export const LongText: Story = {
  decorators: [
    Story => (
      <div className="w-96">
        <Story />
      </div>
    ),
  ],
  args: {
    rows: 4,
    defaultValue: 'A long message that runs over several lines. '.repeat(3),
  },
};

export const WithHeader: Story = {
  args: {
    header: <div className="px-4 pt-2 text-xs text-chrome-muted">Replying to Alice</div>,
  },
};

export const WithTrailingAction: Story = {
  args: {
    trailing: (
      <IconButton label="Send" variant="primary">
        <SendIcon />
      </IconButton>
    ),
  },
};

export const Disabled: Story = {
  args: { disabled: true },
};
