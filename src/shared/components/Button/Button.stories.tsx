import { type Meta, type StoryObj } from '@storybook/react-vite';

import { PlusIcon } from '@/shared/icons';

import { Button } from './Button';

const meta: Meta<typeof Button> = {
  component: Button,
  title: 'Design System/kit/Button',
  args: { children: 'Button' },
};

export default meta;

type Story = StoryObj<typeof Button>;

const variants = ['secondary', 'primary', 'danger', 'ghost'] as const;
const sizes = ['md', 'sm'] as const;
const horizontalSizes = ['normal', 'condensed', 'fill'] as const;

export const Default: Story = {};

export const VariantsAndSizes: Story = {
  render: args => (
    <div className="flex flex-col gap-4">
      {sizes.map(size => (
        <div key={size} className="flex items-center gap-4">
          {variants.map(variant => (
            <Button key={variant} {...args} variant={variant} size={size}>
              {variant} {size}
            </Button>
          ))}
        </div>
      ))}
    </div>
  ),
};

export const HorizontalSizes: Story = {
  render: args => (
    <div className="flex w-80 flex-col items-start gap-4">
      {horizontalSizes.map(horizontalSize => (
        <Button key={horizontalSize} {...args} horizontalSize={horizontalSize}>
          {horizontalSize}
        </Button>
      ))}
    </div>
  ),
};

export const WithLeadingIcon: Story = {
  render: args => (
    <Button {...args}>
      <PlusIcon />
      Add
    </Button>
  ),
};

export const Disabled: Story = {
  render: args => (
    <div className="flex items-center gap-4">
      {variants.map(variant => (
        <Button key={variant} {...args} variant={variant} disabled>
          {variant}
        </Button>
      ))}
    </div>
  ),
};
