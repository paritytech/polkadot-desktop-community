import { type Meta, type StoryObj } from '@storybook/react-vite';

import SendIcon from '@/shared/assets/images/icons/send.svg?jsx';
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
    defaultValue: 'A long message that runs over several lines and keeps going past the five-line cap. '.repeat(6),
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
