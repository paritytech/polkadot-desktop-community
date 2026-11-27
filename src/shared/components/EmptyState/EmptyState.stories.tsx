import { type Meta, type StoryObj } from '@storybook/react-vite';

import InboxIcon from '@/shared/assets/images/icons/inbox.svg?jsx';
import { Button } from '../Button/Button';

import { EmptyState } from './EmptyState';

const meta: Meta<typeof EmptyState> = {
  component: EmptyState,
  title: 'Design System/kit/EmptyState',
  args: { icon: <InboxIcon />, title: 'Nothing here yet' },
};

export default meta;

type Story = StoryObj<typeof EmptyState>;

export const Default: Story = {};

export const WithDescription: Story = {
  args: { description: 'Items you add will show up in this list.' },
};

export const WithAction: Story = {
  args: { action: <Button variant="primary">Add item</Button> },
};

export const WithDescriptionAndAction: Story = {
  args: {
    description: 'Items you add will show up in this list.',
    action: <Button variant="primary">Add item</Button>,
  },
};
