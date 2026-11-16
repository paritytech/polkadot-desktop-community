import paseoNextV2Document from '~trinity/paseo-next-v2.json?raw';
import stackLinks from '~trinity/stacks.json';
import { describe, expect, it } from 'vitest';

import { environmentService } from './service';

describe('environmentService.bundledStack', () => {
  it('pairs the stack link with the bytes of its copy as served', () => {
    const stack = environmentService.bundledStack('paseo-next-v2');

    expect(stack.pointer).toBe(stackLinks['paseo-next-v2']);
    expect(new TextDecoder().decode(stack.descriptor)).toBe(paseoNextV2Document);
  });

  it('throws for a stack not bundled in .trinity/', () => {
    expect(() => environmentService.bundledStack('unknown')).toThrow('[environment] stack "unknown" is not bundled');
  });
});

describe('environmentService.stackOf', () => {
  it("returns the channel's bundled stack", () => {
    expect(environmentService.stackOf('alpha')).toEqual(environmentService.bundledStack('paseo-next-v2'));
  });

  it('throws for a channel missing from the catalog', () => {
    expect(() => environmentService.stackOf('no-such-channel')).toThrow(
      '[environment] channel "no-such-channel" missing from VITE_ENVIRONMENTS',
    );
  });
});
