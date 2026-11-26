// @vitest-environment happy-dom

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { RadioGroup } from './RadioGroup';

type Props = {
  value: string;
  onValueChange?: (value: string) => void;
};

const Languages = ({ value, onValueChange = vi.fn() }: Props) => (
  <RadioGroup.Root label="Language" value={value} onValueChange={onValueChange}>
    <RadioGroup.Item title="English" value="en" />
    <RadioGroup.Item description="Español" title="Spanish" value="es" />
    <RadioGroup.Item title="French" value="fr" />
  </RadioGroup.Root>
);

const radio = (name: string) => screen.getByRole('radio', { name });

describe('RadioGroup', () => {
  it('names the group and its radios', () => {
    render(<Languages value="en" />);

    expect(screen.getByRole('radiogroup', { name: 'Language' })).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(3);
    expect(radio('Spanish')).toBeInTheDocument();
    expect(radio('Spanish')).toHaveAccessibleDescription('Español');
  });

  it('checks the item whose value it is given', () => {
    render(<Languages value="es" />);

    expect(radio('Spanish')).toBeChecked();
    expect(radio('English')).not.toBeChecked();
    expect(radio('French')).not.toBeChecked();
  });

  it('reports a pick and leaves the choice to the owner', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Languages value="en" onValueChange={onValueChange} />);

    await user.click(radio('French'));

    expect(onValueChange).toHaveBeenCalledWith('fr');
    expect(radio('English')).toBeChecked();
    expect(radio('French')).not.toBeChecked();
  });

  it('checks nothing for a value no item has', () => {
    render(<Languages value="xx" />);

    for (const item of screen.getAllByRole('radio')) {
      expect(item).not.toBeChecked();
    }
  });

  it('draws the focus ring on the card, not on the hidden radio', () => {
    render(<Languages value="en" />);

    const input = radio('English');
    expect(input).toHaveClass('outline-none');
    expect(input.closest('label')).toHaveClass('has-[:focus-visible]:outline-chrome-focus');
  });
});
