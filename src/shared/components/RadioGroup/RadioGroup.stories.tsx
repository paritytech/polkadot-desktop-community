import { type Meta, type StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { RadioGroup } from './RadioGroup';

const meta: Meta<typeof RadioGroup.Root> = {
  component: RadioGroup.Root,
  title: 'Design System/kit/RadioGroup',
};

export default meta;

type Story = StoryObj<typeof RadioGroup.Root>;

const ChoiceCards = () => {
  const [value, setValue] = useState('light');

  return (
    <div className="w-80">
      <RadioGroup.Root label="Appearance" value={value} onValueChange={setValue}>
        <RadioGroup.Item value="light" title="Light" description="Bright surfaces." />
        <RadioGroup.Item value="dark" title="Dark" description="Dim surfaces." />
        <RadioGroup.Item value="system" title="System" />
      </RadioGroup.Root>
    </div>
  );
};

export const Default: Story = {
  render: () => <ChoiceCards />,
};
