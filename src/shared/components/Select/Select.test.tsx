// @vitest-environment happy-dom

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Select } from './Select';

const renderSelect = () => {
  const onValueChange = vi.fn();

  render(
    <Select.Root value="b" onValueChange={onValueChange}>
      <Select.Trigger>
        <Select.Value />
      </Select.Trigger>
      <Select.Content>
        <Select.Item value="a">Alpha</Select.Item>
        <Select.Item value="b">Beta</Select.Item>
      </Select.Content>
    </Select.Root>,
  );

  return { onValueChange };
};

describe('Select', () => {
  it('shows the chosen item in its trigger', () => {
    renderSelect();

    expect(screen.getByRole('combobox')).toHaveTextContent('Beta');
  });

  it('lists its items when opened and reports a choice', async () => {
    const user = userEvent.setup();
    const { onValueChange } = renderSelect();

    await user.click(screen.getByRole('combobox'));

    expect(await screen.findAllByRole('option')).toHaveLength(2);

    await user.click(screen.getByRole('option', { name: 'Alpha' }));

    expect(onValueChange).toHaveBeenCalledWith('a');
  });
});
