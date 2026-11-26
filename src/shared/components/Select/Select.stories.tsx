import { type Meta, type StoryObj } from '@storybook/react-vite';

import { Select } from './Select';

const meta: Meta<typeof Select.Root> = {
  component: Select.Root,
  title: 'Design System/kit/Select',
};

export default meta;

type Story = StoryObj<typeof Select.Root>;

export const Default: Story = {
  render: args => (
    <div className="w-64">
      <Select.Root {...args}>
        <Select.Trigger>
          <Select.Value placeholder="Pick a network" />
        </Select.Trigger>
        <Select.Content>
          <Select.Item value="polkadot">Polkadot</Select.Item>
          <Select.Item value="kusama">Kusama</Select.Item>
          <Select.Item value="westend" disabled>
            Westend
          </Select.Item>
          <Select.Item value="paseo">Paseo</Select.Item>
        </Select.Content>
      </Select.Root>
    </div>
  ),
};

export const Disabled: Story = { ...Default, args: { disabled: true, defaultValue: 'polkadot' } };

export const Open: Story = {
  ...Default,
  args: { defaultOpen: true, defaultValue: 'kusama' },
  decorators: [
    Story => (
      <div className="pb-64">
        <Story />
      </div>
    ),
  ],
};
