import { type Meta, type StoryObj } from '@storybook/react-vite';

import { SectionLabel } from './SectionLabel';

const meta: Meta<typeof SectionLabel> = {
  component: SectionLabel,
  title: 'Design System/kit/SectionLabel',
  args: { children: 'Recent' },
};

export default meta;

type Story = StoryObj<typeof SectionLabel>;

export const Default: Story = {};
