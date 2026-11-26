import { type Meta, type StoryObj } from '@storybook/react-vite';

import { AVATAR_TONES, Avatar } from './Avatar';

const meta: Meta<typeof Avatar> = {
  component: Avatar,
  title: 'Design System/kit/Avatar',
  args: { label: 'Alice' },
};

export default meta;

type Story = StoryObj<typeof Avatar>;

const sizes = ['20', '24', '40', '48', '56'] as const;

export const Default: Story = {};

export const Sizes: Story = {
  render: args => (
    <div className="flex items-center gap-4">
      {sizes.map(size => (
        <Avatar key={size} {...args} size={size} />
      ))}
    </div>
  ),
};

export const Tones: Story = {
  render: args => (
    <div className="flex items-center gap-4">
      {AVATAR_TONES.map(tone => (
        <Avatar key={tone} {...args} label={tone} tone={tone} />
      ))}
    </div>
  ),
};

export const EmojiLabel: Story = {
  args: { label: '🦊 Fox' },
};
