import { CreateProofErr, GetAliasErr, ListRingVrfKeysErr, RegisterRingVrfKeyErr, RingVrfSignErr } from '@novasamatech/host-api';
import { describe, expect, it } from 'vitest';

import { isReservedAccountHolder, tryCanonicalizeSelfAlias } from './accountCompatibility';
import { decideAliasPermissionEffect } from './aliasPermissionDecision';
import {
  mapAliasWireError,
  mapListRingVrfKeysWireError,
  mapProofWireError,
  mapRegisterRingVrfKeyWireError,
  mapRingVrfSignWireError,
} from './ringVrfError';

describe('decideAliasPermissionEffect', () => {
  it('maps allow-once to a persisted "ask" effect so the product appears in the permission list', () => {
    expect(decideAliasPermissionEffect('allow-once')).toBe('persist-ask');
  });

  it('maps allow-always to persistent granted effect', () => {
    expect(decideAliasPermissionEffect('allow-always')).toBe('persist-granted');
  });

  it('maps deny to persistent denied effect', () => {
    expect(decideAliasPermissionEffect('deny')).toBe('persist-denied');
  });

  it('maps dismiss to reject effect', () => {
    expect(decideAliasPermissionEffect('dismiss')).toBe('reject');
  });
});

describe('mapProofWireError', () => {
  it('passes decoded CreateProofErr instances through unchanged', () => {
    const decoded = [
      new CreateProofErr.NotMember(),
      new CreateProofErr.RingNotFound(),
      new CreateProofErr.Rejected(),
      new CreateProofErr.Unknown({ reason: 'boom' }),
    ];
    for (const error of decoded) {
      expect(mapProofWireError(error)).toBe(error);
    }
  });

  it('wraps a transport/ack failure as Unknown, carrying its message', () => {
    const result = mapProofWireError(new Error('socket closed'));
    expect(result).toBeInstanceOf(CreateProofErr.Unknown);
    expect(result).toHaveProperty('payload.reason', 'socket closed');
  });
});

describe('mapAliasWireError', () => {
  it('passes decoded GetAliasErr instances through unchanged', () => {
    const decoded = [
      new GetAliasErr.NotMember(),
      new GetAliasErr.RingNotFound(),
      new GetAliasErr.Rejected(),
      new GetAliasErr.Unknown({ reason: 'boom' }),
    ];
    for (const error of decoded) {
      expect(mapAliasWireError(error)).toBe(error);
    }
  });

  it('wraps a transport/ack failure as Unknown, carrying its message', () => {
    const result = mapAliasWireError(new Error('socket closed'));
    expect(result).toBeInstanceOf(GetAliasErr.Unknown);
    expect(result).toHaveProperty('payload.reason', 'socket closed');
  });
});

describe('RFC-0024 registry wire errors', () => {
  it('passes decoded instances through and wraps transport failures as Unknown', () => {
    const registered = new RegisterRingVrfKeyErr.RingNotFound();
    expect(mapRegisterRingVrfKeyWireError(registered)).toBe(registered);
    expect(mapRegisterRingVrfKeyWireError(new Error('socket closed'))).toBeInstanceOf(RegisterRingVrfKeyErr.Unknown);

    const listed = new ListRingVrfKeysErr.Rejected();
    expect(mapListRingVrfKeysWireError(listed)).toBe(listed);
    expect(mapListRingVrfKeysWireError(new Error('socket closed'))).toBeInstanceOf(ListRingVrfKeysErr.Unknown);

    const signed = new RingVrfSignErr.KeyNotRegistered();
    expect(mapRingVrfSignWireError(signed)).toBe(signed);
    expect(mapRingVrfSignWireError(new Error('socket closed'))).toBeInstanceOf(RingVrfSignErr.Unknown);
  });
});

describe('RFC-0024 error variants survive the alias/proof mappers', () => {
  // These variants were inserted before `Rejected`, shifting its wire discriminant. The
  // mappers are instanceof-based, so they must pass through untouched.
  it('passes the new CreateProofErr and GetAliasErr variants through', () => {
    for (const error of [
      new CreateProofErr.KeyNotRegistered(),
      new CreateProofErr.KeyNotInRing(),
      new CreateProofErr.NotAllowlisted(),
    ]) {
      expect(mapProofWireError(error)).toBe(error);
    }

    for (const error of [new GetAliasErr.KeyNotRegistered(), new GetAliasErr.KeyNotInRing()]) {
      expect(mapAliasWireError(error)).toBe(error);
    }
  });
});

// Tests the helpers imported from ./accountCompatibility — the actual exported functions.
describe('tryCanonicalizeSelfAlias (Host Playground self-alias normalisation)', () => {
  it('normalises the self-alias form back to the bare identifier', () => {
    expect(tryCanonicalizeSelfAlias('host-playground.paseo.dot', 'host-playground.paseo')).toBe('host-playground.paseo');
  });

  it('leaves an already-qualified dotNS identifier unchanged', () => {
    expect(tryCanonicalizeSelfAlias('host-playground.paseo', 'host-playground.paseo')).toBe('host-playground.paseo');
    // myapp.dot with canonical myapp IS the self-alias form and gets normalised back.
    expect(tryCanonicalizeSelfAlias('myapp.dot', 'myapp')).toBe('myapp');
  });

  it('a bare dapp name gets .dot appended by the caller; we normalise it back', () => {
    // Host Playground: `myapp` → `myapp.dot` at call site → we strip `.dot` to match identifier `myapp`.
    expect(tryCanonicalizeSelfAlias('myapp.dot', 'myapp')).toBe('myapp');
  });

  it('leaves unrelated identifiers unchanged', () => {
    expect(tryCanonicalizeSelfAlias('other.paseo.dot', 'host-playground.paseo')).toBe('other.paseo.dot');
  });

  it('leaves localhost unchanged', () => {
    expect(tryCanonicalizeSelfAlias('localhost:3000', 'localhost')).toBe('localhost:3000');
  });
});

// Tests the actual exported isReservedAccountHolder from ./accountCompatibility.
// Bypass is applied in getAlias, createProof, and listRingVrfKeys (not ringVrfSign).
describe('isReservedAccountHolder (Host Playground ring-VRF bypass)', () => {
  it('returns true for peopl.dot', () => {
    expect(isReservedAccountHolder('peopl.dot')).toBe(true);
  });

  it('returns false for arbitrary other.dot', () => {
    expect(isReservedAccountHolder('other.dot')).toBe(false);
  });

  it('returns false for other.paseo.dot', () => {
    expect(isReservedAccountHolder('other.paseo.dot')).toBe(false);
  });

  it('returns false for unrelated identifiers', () => {
    expect(isReservedAccountHolder('host-playground.paseo')).toBe(false);
    expect(isReservedAccountHolder('localhost:3000')).toBe(false);
  });
});
