// @vitest-environment happy-dom

import { firstValueFrom } from 'rxjs';
import { describe, expect, it } from 'vitest';

import { online$ } from './online';

describe('online$', () => {
  it('emits the current navigator state on subscribe', async () => {
    await expect(firstValueFrom(online$)).resolves.toBe(navigator.onLine);
  });

  it('emits false when the window fires an offline event', () => {
    const values: boolean[] = [];
    const sub = online$.subscribe(value => values.push(value));
    window.dispatchEvent(new Event('offline'));
    sub.unsubscribe();
    expect(values.at(-1)).toBe(false);
  });

  it('flips back to true when the window fires an online event', () => {
    const values: boolean[] = [];
    const sub = online$.subscribe(value => values.push(value));
    window.dispatchEvent(new Event('offline'));
    window.dispatchEvent(new Event('online'));
    sub.unsubscribe();
    expect(values.at(-1)).toBe(true);
  });
});
