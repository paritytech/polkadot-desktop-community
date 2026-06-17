import { describe, expect, it } from 'vitest';

import { web3SummitGateService } from './service';

describe('web3SummitGateService', () => {
  describe('isW3sEnded', () => {
    it('treats W3S_ENDED as ended', () => {
      expect(web3SummitGateService.isW3sEnded('W3S_ENDED')).toBe(true);
    });

    it('allows normal use for other gate modes', () => {
      expect(web3SummitGateService.isW3sEnded('VERIFICATION_ENABLED')).toBe(false);
      expect(web3SummitGateService.isW3sEnded('VERIFICATION_ENABLED_SKIPPABLE')).toBe(false);
      expect(web3SummitGateService.isW3sEnded('VERIFICATION_DISABLED')).toBe(false);
    });
  });

  describe('resolveGateMode', () => {
    it('returns the provided mode', () => {
      expect(web3SummitGateService.resolveGateMode('W3S_ENDED')).toBe('W3S_ENDED');
    });

    it('defaults to VERIFICATION_ENABLED when the flag is missing', () => {
      expect(web3SummitGateService.resolveGateMode(null)).toBe('VERIFICATION_ENABLED');
    });
  });
});
