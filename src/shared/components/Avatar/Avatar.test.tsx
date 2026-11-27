// @vitest-environment happy-dom

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Avatar } from './Avatar';

describe('Avatar', () => {
  it('shows two initials of one word, named by the label', () => {
    render(<Avatar label="Goldie.89" />);

    expect(screen.getByRole('img', { name: 'Goldie.89' })).toHaveTextContent('GO');
  });

  it('takes the first letters of the first two words', () => {
    render(<Avatar label="Alice Smith Jones" />);

    expect(screen.getByRole('img')).toHaveTextContent('AS');
  });

  it('shows one initial for a one-letter word', () => {
    render(<Avatar label="A" />);

    expect(screen.getByRole('img')).toHaveTextContent(/^A$/);
  });

  it('skips leading and repeated whitespace', () => {
    render(<Avatar label="  alice   smith " />);

    expect(screen.getByRole('img')).toHaveTextContent('AS');
  });

  it('counts an emoji sequence as one letter', () => {
    render(<Avatar label="👨‍👩‍👧 Family" />);

    expect(screen.getByRole('img')).toHaveTextContent('👨‍👩‍👧F');
  });

  it('upper-cases accented letters', () => {
    render(<Avatar label="émile" />);

    expect(screen.getByRole('img')).toHaveTextContent('ÉM');
  });

  it('names itself by alt when given', () => {
    render(<Avatar label="goldie" alt="Goldie's avatar" />);

    expect(screen.getByRole('img', { name: "Goldie's avatar" })).toBeInTheDocument();
  });

  it('shows a hidden glyph for a blank label', () => {
    const { container } = render(<Avatar label=" " />);

    expect(screen.queryByRole('img')).toBeNull();
    const root = container.firstElementChild;
    expect(root).toHaveAttribute('aria-hidden', 'true');
    expect(root?.querySelector('svg')).not.toBeNull();
  });

  it('names the glyph by alt', () => {
    render(<Avatar label="" alt="Account" />);

    expect(screen.getByRole('img', { name: 'Account' }).querySelector('svg')).not.toBeNull();
  });

  it("draws dot.li's disc", () => {
    render(<Avatar label="goldie" />);

    expect(screen.getByRole('img')).toHaveClass('bg-(image:--chrome-avatar)', 'shadow-chrome-raised', 'text-chrome-text');
  });

  it('sizes 24 as size-6 with the xs step', () => {
    render(<Avatar label="goldie" size="24" />);

    expect(screen.getByRole('img')).toHaveClass('size-6', 'text-xs');
  });

  it('sizes 136 as size-34 with the 4xl step', () => {
    render(<Avatar label="goldie" size="136" />);

    expect(screen.getByRole('img')).toHaveClass('size-34', 'text-4xl');
  });
});
