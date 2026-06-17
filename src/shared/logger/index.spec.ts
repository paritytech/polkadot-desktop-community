import { afterEach, describe, expect, it, vi } from 'vitest';

import { silenceDebugConsole } from './index';

describe('silenceDebugConsole', () => {
  const original = { ...console };

  afterEach(() => {
    Object.assign(console, original);
    vi.restoreAllMocks();
  });

  it('replaces debug with a no-op', () => {
    const debug = vi.spyOn(console, 'debug').mockImplementation(noop);

    silenceDebugConsole();
    console.debug('muted');

    expect(debug).not.toHaveBeenCalled();
  });

  it('keeps info, warn and error untouched', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(noop);
    const warn = vi.spyOn(console, 'warn').mockImplementation(noop);
    const error = vi.spyOn(console, 'error').mockImplementation(noop);

    silenceDebugConsole();
    console.info('info %d', 0);
    console.warn('warn %d', 1);
    console.error('error %d', 2);

    expect(info).toHaveBeenCalledWith('info %d', 0);
    expect(warn).toHaveBeenCalledWith('warn %d', 1);
    expect(error).toHaveBeenCalledWith('error %d', 2);
  });
});

function noop() {}
