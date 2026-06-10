import * as v from 'valibot';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getValueMock = vi.fn<(rc: unknown, key: string) => { asString: () => string }>();
const getInstanceMock = vi.fn<() => unknown>();

vi.mock('firebase/remote-config', () => ({
  getValue: (rc: unknown, key: string) => getValueMock(rc, key),
}));

vi.mock('./bootstrap', () => ({
  getRemoteConfigInstance: () => getInstanceMock(),
}));

const { remoteConfigGateway } = await import('./gateway');

const asString = (value: string) => ({ asString: () => value });

beforeEach(() => {
  getValueMock.mockReset();
  getInstanceMock.mockReset();
  getInstanceMock.mockReturnValue({});
});

describe('remoteConfigGateway.tryGetJson', () => {
  const schema = v.array(v.object({ id: v.number() }));

  it('returns null when Remote Config is not initialized', () => {
    getInstanceMock.mockReturnValue(null);

    expect(remoteConfigGateway.tryGetJson('chains_v2', schema)).toBeNull();
    expect(getValueMock).not.toHaveBeenCalled();
  });

  it('returns null for an unset (empty string) parameter', () => {
    getValueMock.mockReturnValue(asString(''));

    expect(remoteConfigGateway.tryGetJson('chains_v2', schema)).toBeNull();
  });

  it('returns null when the value is not valid JSON', () => {
    getValueMock.mockReturnValue(asString('not-json'));

    expect(remoteConfigGateway.tryGetJson('chains_v2', schema)).toBeNull();
  });

  it('returns null when the parsed value fails schema validation', () => {
    getValueMock.mockReturnValue(asString('[{"id":"not-a-number"}]'));

    expect(remoteConfigGateway.tryGetJson('chains_v2', schema)).toBeNull();
  });

  it('returns the validated value when the parameter is valid', () => {
    getValueMock.mockReturnValue(asString('[{"id":1},{"id":2}]'));

    expect(remoteConfigGateway.tryGetJson('chains_v2', schema)).toEqual([{ id: 1 }, { id: 2 }]);
  });
});

describe('remoteConfigGateway.tryGetString', () => {
  const urlSchema = v.pipe(v.string(), v.url());

  it('returns null when Remote Config is not initialized', () => {
    getInstanceMock.mockReturnValue(null);

    expect(remoteConfigGateway.tryGetString('ipfs_gateway_url', urlSchema)).toBeNull();
    expect(getValueMock).not.toHaveBeenCalled();
  });

  it('returns null for an unset (empty string) parameter', () => {
    getValueMock.mockReturnValue(asString(''));

    expect(remoteConfigGateway.tryGetString('ipfs_gateway_url', urlSchema)).toBeNull();
  });

  it('returns null when the raw value fails validation', () => {
    getValueMock.mockReturnValue(asString('not-a-url'));

    expect(remoteConfigGateway.tryGetString('ipfs_gateway_url', urlSchema)).toBeNull();
  });

  it('returns the raw value when it passes validation (it is NOT JSON-parsed)', () => {
    getValueMock.mockReturnValue(asString('https://previewnet.substrate.dev/ipfs/'));

    expect(remoteConfigGateway.tryGetString('ipfs_gateway_url', urlSchema)).toBe('https://previewnet.substrate.dev/ipfs/');
  });
});
