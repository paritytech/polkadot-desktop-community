import { type Meta, type StoryObj } from '@storybook/react-vite';
import { GlobeIcon, PlusIcon } from 'lucide-react';

import { IconButton } from '../IconButton/IconButton';

import { PaneHeader } from './PaneHeader';

const meta: Meta<typeof PaneHeader> = {
  component: PaneHeader,
  title: 'Design System/kit/PaneHeader',
  args: { children: 'Title' },
  decorators: [
    Story => (
      <div className="w-96">
        <Story />
      </div>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof PaneHeader>;

const actions = (
  <IconButton label="Add" onClick={() => {}}>
    <PlusIcon />
  </IconButton>
);

export const Page: Story = {
  args: { variant: 'page', icon: <GlobeIcon className="size-5" />, subtitle: 'Subtitle', onBack: () => {}, actions },
};

export const List: Story = {
  args: { variant: 'list', icon: <GlobeIcon className="size-5" />, subtitle: 'Subtitle', onBack: () => {}, actions },
};

export const TitleOnly: Story = {};
