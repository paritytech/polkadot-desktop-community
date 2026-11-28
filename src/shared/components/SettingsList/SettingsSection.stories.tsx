import { type Meta, type StoryObj } from '@storybook/react-vite';

import { GlobeIcon } from '@/shared/icons';
import { ListItem } from '../ListItem/ListItem';

import { SettingsSection } from './SettingsSection';

const meta: Meta<typeof SettingsSection> = {
  component: SettingsSection,
  title: 'Design System/kit/SettingsSection',
  decorators: [
    Story => (
      <div className="w-96">
        <Story />
      </div>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof SettingsSection>;

export const Plain: Story = {
  args: { title: 'Appearance', layout: 'plain', children: <p className="text-sm text-chrome-text">Section content</p> },
};

export const List: Story = {
  args: {
    layout: 'list',
    children: (
      <>
        <ListItem icon={<GlobeIcon />} label="Polkadot" chevron onClick={() => {}} />
        <ListItem icon={<GlobeIcon />} label="Kusama" chevron onClick={() => {}} />
      </>
    ),
  },
};
