import { p256 } from '@noble/curves/nist.js';
import { describe, expect, it } from 'vitest';

import { EncryptedHandshakeResponseV2 } from './codec';
import { type HandshakeState, advance, canSubmitV2Statements, fromInnerResponse, idle, isTerminal, submitted } from './state';

const decode = (value: ReturnType<typeof EncryptedHandshakeResponseV2.dec>) =>
  EncryptedHandshakeResponseV2.dec(EncryptedHandshakeResponseV2.enc(value));

const makeSuccess = (): HandshakeState => {
  const identityChatPrivateKey = new Uint8Array(32).fill(0x05);
  return {
    tag: 'Success',
    identityAccountId: new Uint8Array(32).fill(0xb2),
    rootAccountId: new Uint8Array(32).fill(0xc3),
    identityChatPrivateKey,
    identityChatPublicKey: p256.getPublicKey(identityChatPrivateKey, false),
    deviceEncPubKey: new Uint8Array(65).fill(0x04),
    ssoEncPubKey: null,
  };
};

describe('fromInnerResponse', () => {
  it('maps Pending(AllowanceAllocation) to Pending state', () => {
    const r = decode({ tag: 'Pending', value: { tag: 'AllowanceAllocation', value: undefined } });
    expect(fromInnerResponse(r)).toEqual({ tag: 'Pending', reason: 'AllowanceAllocation' });
  });

  it('maps Success to Success state, deriving identityChatPublicKey from the private scalar', () => {
    const identityChatPrivateKey = p256.utils.randomSecretKey();
    const r = decode({
      tag: 'Success',
      value: {
        identityAccountId: new Uint8Array(32).fill(0xb2),
        rootAccountId: new Uint8Array(32).fill(0xc3),
        identityChatPrivateKey,
        deviceEncPubKey: new Uint8Array(65).fill(0x04),
      },
    });
    const state = fromInnerResponse(r);
    expect(state.tag).toBe('Success');
    if (state.tag === 'Success') {
      expect(state.identityAccountId.length).toBe(32);
      expect(state.rootAccountId).not.toBeNull();
      expect(state.rootAccountId!.length).toBe(32);
      expect(state.rootAccountId).not.toEqual(state.identityAccountId);
      expect(state.identityChatPrivateKey.length).toBe(32);
      expect(state.identityChatPublicKey).toEqual(p256.getPublicKey(identityChatPrivateKey, false));
      expect(state.deviceEncPubKey.length).toBe(65);
    }
  });

  it('maps Failed to Failed state with reason string', () => {
    const r = decode({ tag: 'Failed', value: 'no slot available' });
    expect(fromInnerResponse(r)).toEqual({ tag: 'Failed', reason: 'no slot available' });
  });
});

describe('advance', () => {
  it('Idle → Submitted is allowed', () => {
    expect(advance(idle(), submitted())).toEqual(submitted());
  });

  it('Submitted → Pending is allowed', () => {
    const pending: HandshakeState = { tag: 'Pending', reason: 'AllowanceAllocation' };
    expect(advance(submitted(), pending)).toEqual(pending);
  });

  it('Pending → Success is allowed', () => {
    const pending: HandshakeState = { tag: 'Pending', reason: 'AllowanceAllocation' };
    const success = makeSuccess();
    expect(advance(pending, success)).toEqual(success);
  });

  it('terminal states are absorbing — Success cannot regress to Pending', () => {
    const success = makeSuccess();
    const pending: HandshakeState = { tag: 'Pending', reason: 'AllowanceAllocation' };
    expect(advance(success, pending)).toEqual(success);
  });

  it('terminal states are absorbing — Failed cannot regress to Pending', () => {
    const failed: HandshakeState = { tag: 'Failed', reason: 'declined' };
    const pending: HandshakeState = { tag: 'Pending', reason: 'AllowanceAllocation' };
    expect(advance(failed, pending)).toEqual(failed);
  });

  it('Submitted → Idle is rejected (no backwards regression)', () => {
    expect(advance(submitted(), idle())).toEqual(submitted());
  });

  it('Idle → Pending is rejected (must Submit first)', () => {
    const pending: HandshakeState = { tag: 'Pending', reason: 'AllowanceAllocation' };
    expect(advance(idle(), pending)).toEqual(idle());
  });
});

describe('isTerminal', () => {
  it('returns true for Success', () => {
    expect(isTerminal(makeSuccess())).toBe(true);
  });

  it('returns true for Failed', () => {
    expect(isTerminal({ tag: 'Failed', reason: 'declined' })).toBe(true);
  });

  it('returns false for Idle / Submitted / Pending', () => {
    expect(isTerminal(idle())).toBe(false);
    expect(isTerminal(submitted())).toBe(false);
    expect(isTerminal({ tag: 'Pending', reason: 'AllowanceAllocation' })).toBe(false);
  });
});

describe('canSubmitV2Statements', () => {
  it('only true in Success', () => {
    expect(canSubmitV2Statements(makeSuccess())).toBe(true);
    expect(canSubmitV2Statements(idle())).toBe(false);
    expect(canSubmitV2Statements(submitted())).toBe(false);
    expect(canSubmitV2Statements({ tag: 'Pending', reason: 'AllowanceAllocation' })).toBe(false);
    expect(canSubmitV2Statements({ tag: 'Failed', reason: 'x' })).toBe(false);
  });
});
