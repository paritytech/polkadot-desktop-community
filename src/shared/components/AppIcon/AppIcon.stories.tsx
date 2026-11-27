import { type Meta, type StoryObj } from '@storybook/react-vite';

import GlobeIcon from '@/shared/assets/images/icons/globe.svg?jsx';

import { AppIcon } from './AppIcon';

const imageSrc = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#e6007a"/><circle cx="32" cy="32" r="14" fill="#fff"/></svg>',
)}`;

const meta: Meta<typeof AppIcon> = {
  component: AppIcon,
  title: 'Design System/kit/AppIcon',
  args: { size: '44' },
};

export default meta;

type Story = StoryObj<typeof AppIcon>;

const sizes = ['24', '44', '64'] as const;

export const WithImage: Story = {
  render: args => (
    <div className="flex items-center gap-4">
      {sizes.map(size => (
        <AppIcon key={size} {...args} size={size} src={imageSrc} alt="App" />
      ))}
    </div>
  ),
};

export const WithGlyph: Story = {
  render: args => (
    <div className="flex items-center gap-4">
      {sizes.map(size => (
        <AppIcon key={size} {...args} size={size}>
          <GlobeIcon className="size-6" />
        </AppIcon>
      ))}
    </div>
  ),
};

export const Placeholder: Story = {
  render: args => (
    <div className="flex items-center gap-4">
      {sizes.map(size => (
        <AppIcon key={size} {...args} size={size} />
      ))}
    </div>
  ),
};
