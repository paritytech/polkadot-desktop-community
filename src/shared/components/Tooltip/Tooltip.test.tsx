// @vitest-environment happy-dom

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { Tooltip } from './Tooltip';

describe('Tooltip', () => {
  it('shows on keyboard focus', async () => {
    render(
      <Tooltip.Provider>
        <Tooltip.Root>
          <Tooltip.Trigger asChild>
            <button>Info</button>
          </Tooltip.Trigger>
          <Tooltip.Content>More</Tooltip.Content>
        </Tooltip.Root>
      </Tooltip.Provider>,
    );

    await userEvent.setup().tab();

    expect(await screen.findByRole('tooltip')).toHaveTextContent('More');
  });
});
