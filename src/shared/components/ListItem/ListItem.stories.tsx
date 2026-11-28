import { type Meta, type StoryObj } from '@storybook/react-vite';

import { GlobeIcon, TrashIcon } from '@/shared/icons';
import { IconButton } from '../IconButton/IconButton';
import { SettingsSection } from '../SettingsList/SettingsSection';

import { ListItem } from './ListItem';

const meta: Meta<typeof ListItem> = {
  component: ListItem,
  title: 'Design System/kit/ListItem',
  args: { label: 'Label' },
};

export default meta;

type Story = StoryObj<typeof ListItem>;

export const Default: Story = {
  args: { icon: <GlobeIcon />, label: 'Network', description: 'Polkadot Asset Hub', onClick: () => {} },
};

export const Rows: Story = {
  render: () => (
    <div className="w-96">
      <SettingsSection layout="list">
        <ListItem icon={<GlobeIcon />} label="Navigable" description="Opens a page" chevron onClick={() => {}} />
        <ListItem icon={<GlobeIcon />} label="With meta" meta="12 items" onClick={() => {}} />
        <ListItem icon={<GlobeIcon />} label="Selected" selected onClick={() => {}} />
        <ListItem
          icon={<GlobeIcon />}
          label="With action"
          description="Action keeps its own clicks"
          action={
            <IconButton label="Delete" onClick={() => {}}>
              <TrashIcon />
            </IconButton>
          }
          onClick={() => {}}
        />
        <ListItem icon={<GlobeIcon />} label="Static" description="No click handler" />
        <ListItem icon={<GlobeIcon />} label="Disabled" description="Not available" disabled onClick={() => {}} />
        <ListItem
          icon={<GlobeIcon />}
          label="A very long label that has to be truncated inside the row instead of wrapping"
          description="A very long description that has to be truncated inside the row instead of wrapping"
          chevron
          onClick={() => {}}
        />
      </SettingsSection>
    </div>
  ),
};
