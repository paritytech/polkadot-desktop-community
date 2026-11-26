import { afterEach, describe, expect, it, vi } from 'vitest';

import { createLightSpecLoader } from './lightClient';

const A = { genesisHash: '0xaa', url: 'https://spec/a' };
const B = { genesisHash: '0xbb', url: 'https://spec/b' };

const bytesA = new Uint8Array([1]);
const bytesB = new Uint8Array([2]);

function bytesFor(url: string): Uint8Array {
  return url === A.url ? bytesA : bytesB;
}

describe('createLightSpecLoader', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches each spec once when called concurrently', async () => {
    const handle = { addLightSpec: vi.fn() };
    const fetchLightSpec = vi.fn((url: string) => Promise.resolve(bytesFor(url)));
    const ensure = createLightSpecLoader([A, B], handle, fetchLightSpec);

    await Promise.all([ensure(), ensure()]);

    expect(fetchLightSpec).toHaveBeenCalledTimes(2);
    expect(fetchLightSpec).toHaveBeenCalledWith(A.url);
    expect(fetchLightSpec).toHaveBeenCalledWith(B.url);
    expect(handle.addLightSpec).toHaveBeenCalledTimes(2);
    expect(handle.addLightSpec).toHaveBeenCalledWith('0xaa', bytesA);
    expect(handle.addLightSpec).toHaveBeenCalledWith('0xbb', bytesB);
  });

  it('adds the specs that arrived when one fetch fails, and resolves', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const handle = { addLightSpec: vi.fn() };
    const fetchLightSpec = vi.fn((url: string) =>
      url === B.url ? Promise.reject(new Error('offline')) : Promise.resolve(bytesFor(url)),
    );
    const ensure = createLightSpecLoader([A, B], handle, fetchLightSpec);

    await expect(ensure()).resolves.toBeUndefined();

    expect(handle.addLightSpec).toHaveBeenCalledTimes(1);
    expect(handle.addLightSpec).toHaveBeenCalledWith('0xaa', bytesA);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain('0xbb');
    expect(warn.mock.calls[0]?.[0]).toContain('https://spec/b');
  });

  it('fetches only the missing spec on the next call', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const handle = { addLightSpec: vi.fn() };
    const fetchLightSpec = vi.fn((url: string) =>
      url === B.url ? Promise.reject(new Error('offline')) : Promise.resolve(bytesFor(url)),
    );
    const ensure = createLightSpecLoader([A, B], handle, fetchLightSpec);

    await ensure();
    fetchLightSpec.mockClear();
    handle.addLightSpec.mockClear();
    fetchLightSpec.mockImplementation((url: string) => Promise.resolve(bytesFor(url)));

    await ensure();

    expect(fetchLightSpec).toHaveBeenCalledTimes(1);
    expect(fetchLightSpec).toHaveBeenCalledWith(B.url);
    expect(handle.addLightSpec).toHaveBeenCalledTimes(1);
    expect(handle.addLightSpec).toHaveBeenCalledWith('0xbb', bytesB);
  });

  it('fetches again a spec the provider refused', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const handle = {
      addLightSpec: vi.fn((genesisHash: string) => {
        if (genesisHash === B.genesisHash) throw new Error('sha256 mismatch');
      }),
    };
    const fetchLightSpec = vi.fn((url: string) => Promise.resolve(bytesFor(url)));
    const ensure = createLightSpecLoader([A, B], handle, fetchLightSpec);

    await ensure();
    fetchLightSpec.mockClear();

    await ensure();

    expect(fetchLightSpec).toHaveBeenCalledTimes(1);
    expect(fetchLightSpec).toHaveBeenCalledWith(B.url);
  });
});
