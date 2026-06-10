import * as v from 'valibot';
import { describe, expect, it, vi } from 'vitest';

import { genesisHash } from '../chain/schemas';
import { type Chain } from '../chain/types';

const status = vi.fn();
const onStatusChanged = vi.fn();
const api$ = vi.fn();

vi.mock('./registry', () => ({
  chainRegistry: {
    status: (...args: unknown[]) => status(...args),
    onStatusChanged: (...args: unknown[]) => onStatusChanged(...args),
    api$: (...args: unknown[]) => api$(...args),
  },
}));

import { chainConnectionStatusResource } from './resource';

const genesis = v.parse(genesisHash, '0x0000000000000000000000000000000000000000000000000000000000000000');
const fakeChain: Chain = {
  chainId: genesis,
  genesisHash: genesis,
  name: 'People',
  assets: [],
  nodes: [],
  addressPrefix: 0,
};

describe('chainConnectionStatusResource', () => {
  it('emits the current status immediately, then on every change, and cleans up on unsubscribe', () => {
    status.mockReturnValue('connecting');
    let statusCb: (s: string) => void = () => {};
    const unsubscribeStatus = vi.fn();
    onStatusChanged.mockImplementation((_genesisHash: string, cb: (s: string) => void) => {
      statusCb = cb;
      return unsubscribeStatus;
    });
    const apiUnsubscribe = vi.fn();
    api$.mockReturnValue({ subscribe: () => ({ unsubscribe: apiUnsubscribe }) });

    const emissions: string[] = [];
    const subscription = chainConnectionStatusResource.read$(fakeChain).subscribe(value => emissions.push(value));

    expect(emissions).toEqual(['connecting']);

    statusCb('connected');
    expect(emissions).toEqual(['connecting', 'connected']);

    subscription.unsubscribe();
    expect(unsubscribeStatus).toHaveBeenCalledOnce();
    expect(apiUnsubscribe).toHaveBeenCalledOnce();
  });

  it('propagates an api$ init failure to the subscriber and cleans up', () => {
    status.mockReturnValue('connecting');
    const unsubscribeStatus = vi.fn();
    onStatusChanged.mockReturnValue(unsubscribeStatus);

    let apiObserver: { error: (error: unknown) => void } = { error: () => {} };
    const apiUnsubscribe = vi.fn();
    api$.mockReturnValue({
      subscribe: (observer: { error: (error: unknown) => void }) => {
        apiObserver = observer;
        return { unsubscribe: apiUnsubscribe };
      },
    });

    const error = new Error('No runtime descriptor available');
    const emissions: string[] = [];
    let caught: unknown = null;
    chainConnectionStatusResource.read$(fakeChain).subscribe({
      next: value => emissions.push(value),
      error: err => {
        caught = err;
      },
    });

    expect(emissions).toEqual(['connecting']);

    apiObserver.error(error);

    expect(caught).toBe(error);
    expect(unsubscribeStatus).toHaveBeenCalledOnce();
    expect(apiUnsubscribe).toHaveBeenCalledOnce();
  });
});
