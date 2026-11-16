import { describe, expect, it, vi } from 'vitest';

import { createConnectionManager } from './createConnectionManager';

describe('createConnectionManager', () => {
  it('returns disconnected for unknown chainId', () => {
    const manager = createConnectionManager();
    expect(manager.getConnectionStatus('unknown')).toBe('disconnected');
  });

  it('returns current status after update', () => {
    const manager = createConnectionManager();
    manager.update('chain-a', 'connecting');
    expect(manager.getConnectionStatus('chain-a')).toBe('connecting');

    manager.update('chain-a', 'connected');
    expect(manager.getConnectionStatus('chain-a')).toBe('connected');
  });

  it('fires onStatusChange callbacks', () => {
    const manager = createConnectionManager();
    const callback = vi.fn();

    manager.onStatusChange('chain-a', callback);
    manager.update('chain-a', 'connected');

    expect(callback).toHaveBeenCalledWith('connected');
  });

  it('only fires for matching chainId', () => {
    const manager = createConnectionManager();
    const callback = vi.fn();

    manager.onStatusChange('chain-a', callback);
    manager.update('chain-b', 'connected');

    expect(callback).not.toHaveBeenCalled();
  });

  it('supports multiple subscribers', () => {
    const manager = createConnectionManager();
    const cb1 = vi.fn();
    const cb2 = vi.fn();

    manager.onStatusChange('chain-a', cb1);
    manager.onStatusChange('chain-a', cb2);
    manager.update('chain-a', 'connected');

    expect(cb1).toHaveBeenCalledWith('connected');
    expect(cb2).toHaveBeenCalledWith('connected');
  });

  it('unsubscribe stops notifications', () => {
    const manager = createConnectionManager();
    const callback = vi.fn();

    const unsub = manager.onStatusChange('chain-a', callback);
    unsub();
    manager.update('chain-a', 'connected');

    expect(callback).not.toHaveBeenCalled();
  });
});
