import { describe, expect, it, vi } from 'vitest';

import { guarded } from './guarded';

describe('guarded', () => {
  it('forwards args and returns the inner result while alive', () => {
    const fn = vi.fn((n: number) => n * 2);
    const inst = { disposed: false };
    const wrapped = guarded(inst, fn);

    expect(wrapped(3)).toBe(6);
    expect(fn).toHaveBeenCalledWith(3);
  });

  it('no-ops after disposed flips to true', () => {
    const fn = vi.fn();
    const inst = { disposed: false };
    const wrapped = guarded(inst, fn);

    inst.disposed = true;
    const result = wrapped();

    expect(fn).not.toHaveBeenCalled();
    expect(result).toBeUndefined();
  });

  it('reads disposed at call time, not at wrap time', () => {
    const fn = vi.fn();
    const inst = { disposed: true };
    const wrapped = guarded(inst, fn);

    inst.disposed = false;
    wrapped();

    expect(fn).toHaveBeenCalledTimes(1);
  });
});
