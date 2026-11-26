import { describe, expect, it } from 'vitest';

import { cnTw } from './twMerge';

describe('cnTw', () => {
  it('treats the control heights as heights', () => {
    expect(cnTw('h-8 h-control')).toBe('h-control');
    expect(cnTw('size-6 size-control-sm')).toBe('size-control-sm');
    expect(cnTw('min-h-10 min-h-control')).toBe('min-h-control');
    expect(cnTw('h-control h-control-sm')).toBe('h-control-sm');
  });
});
