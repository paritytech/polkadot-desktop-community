import { type Meta, type StoryObj } from '@storybook/react-vite';

import SearchIcon from '@/shared/assets/images/icons/search.svg?jsx';
import XIcon from '@/shared/assets/images/icons/x.svg?jsx';
import { IconButton } from '../IconButton/IconButton';

import { Input } from './Input';

const meta: Meta<typeof Input> = {
  component: Input,
  title: 'Design System/kit/Input',
  args: { placeholder: 'Search' },
};

export default meta;

type Story = StoryObj<typeof Input>;

export const Default: Story = {};

export const WithLeading: Story = {
  args: { leading: <SearchIcon /> },
};

export const WithTrailing: Story = {
  args: {
    defaultValue: 'polkadot',
    trailing: (
      <IconButton label="Clear" size="sm">
        <XIcon />
      </IconButton>
    ),
  },
};

export const Disabled: Story = {
  args: { disabled: true, leading: <SearchIcon /> },
};
