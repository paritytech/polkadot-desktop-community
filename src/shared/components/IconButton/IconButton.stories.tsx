import { type Meta, type StoryObj } from '@storybook/react-vite';
import { SettingsIcon } from 'lucide-react';

import { IconButton } from './IconButton';

const meta: Meta<typeof IconButton> = {
  component: IconButton,
  title: 'Design System/kit/IconButton',
  args: { label: 'Settings', children: <SettingsIcon /> },
};

export default meta;

type Story = StoryObj<typeof IconButton>;

const variants = ['ghost', 'raised', 'primary'] as const;
const sizes = ['md', 'sm'] as const;

export const Default: Story = {};

export const VariantsAndSizes: Story = {
  render: args => (
    <div className="flex flex-col gap-4">
      {sizes.map(size => (
        <div key={size} className="flex items-center gap-4">
          {variants.map(variant => (
            <IconButton key={variant} {...args} variant={variant} size={size} label={`${variant} ${size}`} />
          ))}
        </div>
      ))}
    </div>
  ),
};

export const Disabled: Story = {
  render: args => (
    <div className="flex items-center gap-4">
      {variants.map(variant => (
        <IconButton key={variant} {...args} variant={variant} label={`${variant} disabled`} disabled />
      ))}
    </div>
  ),
};

export const Expanded: Story = {
  args: { 'aria-expanded': true },
};
