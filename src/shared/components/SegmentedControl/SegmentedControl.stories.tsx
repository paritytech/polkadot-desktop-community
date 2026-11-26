import { type Meta, type StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { SegmentedControl } from './SegmentedControl';

const meta: Meta<typeof SegmentedControl.Root> = {
  component: SegmentedControl.Root,
  title: 'Design System/kit/SegmentedControl',
  parameters: { controls: { disable: true } },
};

export default meta;

type Story = StoryObj<typeof SegmentedControl.Root>;

const Choices = () => {
  const [value, setValue] = useState('day');

  return (
    <div className="w-72">
      <SegmentedControl.Root label="Range" value={value} onChange={setValue}>
        <SegmentedControl.Item value="day">Day</SegmentedControl.Item>
        <SegmentedControl.Item value="week">Week</SegmentedControl.Item>
        <SegmentedControl.Item value="month" disabled>
          Month
        </SegmentedControl.Item>
      </SegmentedControl.Root>
    </div>
  );
};

export const Default: Story = {
  render: () => <Choices />,
};
