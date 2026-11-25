// @vitest-environment happy-dom

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Avatar } from './Avatar';

describe('Avatar', () => {
  it('shows the first letter, named by the label', () => {
    render(<Avatar label="goldie" />);

    expect(screen.getByRole('img', { name: 'goldie' })).toHaveTextContent('G');
  });

  it('names itself by alt when given', () => {
    render(<Avatar label="goldie" alt="Goldie's avatar" />);

    expect(screen.getByRole('img', { name: "Goldie's avatar" })).toBeInTheDocument();
  });

  it('puts the tone classes on the circle', () => {
    render(<Avatar label="goldie" tone="ruby" />);

    expect(screen.getByRole('img')).toHaveClass('bg-avatar-bg-ruby', 'text-avatar-fg-ruby');
  });

  it('shows ? for a blank label', () => {
    render(<Avatar label=" " />);

    expect(screen.getByRole('img')).toHaveTextContent('?');
  });

  it('skips leading whitespace', () => {
    render(<Avatar label=" goldie" />);

    expect(screen.getByRole('img')).toHaveTextContent('G');
  });
});
