import { type Meta, type StoryObj } from '@storybook/react-vite';

import { CopyButton } from './CopyButton';

const meta: Meta<typeof CopyButton> = {
  component: CopyButton,
  title: 'Design System/kit/CopyButton',
  args: { value: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY', label: 'Copy address' },
};

export default meta;

type Story = StoryObj<typeof CopyButton>;

export const Default: Story = {};

export const Disabled: Story = { args: { disabled: true } };
