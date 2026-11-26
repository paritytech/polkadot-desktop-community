import { type Meta, type StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { Switch } from './Switch';

const meta: Meta<typeof Switch> = {
  component: Switch,
  title: 'Design System/kit/Switch',
  args: { label: 'Notifications', checked: false, onCheckedChange: () => {} },
  parameters: { controls: { include: ['label'] } },
};

export default meta;

type Story = StoryObj<typeof Switch>;

const InteractiveSwitch = ({ initial, label }: { initial: boolean; label: string }) => {
  const [checked, setChecked] = useState(initial);

  return <Switch checked={checked} label={label} onCheckedChange={setChecked} />;
};

export const Off: Story = {
  render: args => <InteractiveSwitch initial={false} label={args.label} />,
};

export const On: Story = {
  render: args => <InteractiveSwitch initial label={args.label} />,
};
