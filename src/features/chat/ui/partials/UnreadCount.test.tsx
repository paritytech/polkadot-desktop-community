// @vitest-environment happy-dom

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { UnreadCount } from './UnreadCount';

describe('UnreadCount', () => {
  it('renders the count', () => {
    render(<UnreadCount count={3} />);

    expect(screen.getByText('3')).toBeTruthy();
  });

  it('renders the reaction mark as an svg', () => {
    const { container } = render(<UnreadCount reaction />);

    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('renders nothing for a zero count without a reaction', () => {
    const { container } = render(<UnreadCount count={0} />);

    expect(container.innerHTML).toBe('');
  });
});
