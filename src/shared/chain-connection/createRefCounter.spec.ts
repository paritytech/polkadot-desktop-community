import { describe, expect, it } from 'vitest';

import { createRefCounter } from './createRefCounter';

describe('createRefCounter', () => {
  it('returns 0 for unknown key', () => {
    const counter = createRefCounter<string>();
    expect(counter.refs('a')).toBe(0);
  });

  it('increment returns new count', () => {
    const counter = createRefCounter<string>();
    expect(counter.increment('a')).toBe(1);
    expect(counter.increment('a')).toBe(2);
  });

  it('tracks independently per key', () => {
    const counter = createRefCounter<string>();
    counter.increment('a');
    counter.increment('a');
    counter.increment('b');

    expect(counter.refs('a')).toBe(2);
    expect(counter.refs('b')).toBe(1);
  });

  it('decrement returns new count', () => {
    const counter = createRefCounter<string>();
    counter.increment('a');
    counter.increment('a');
    expect(counter.decrement('a')).toBe(1);
    expect(counter.decrement('a')).toBe(0);
  });

  it('decrement floors at 0', () => {
    const counter = createRefCounter<string>();
    expect(counter.decrement('a')).toBe(0);
    expect(counter.decrement('a')).toBe(0);
  });
});
