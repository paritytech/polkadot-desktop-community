import { describe, expect, it } from 'vitest';

import { computeGhostSuffix } from './computeGhostSuffix';

describe('computeGhostSuffix', () => {
  it('returns empty for empty / whitespace input', () => {
    expect(computeGhostSuffix('')).toBe('');
    expect(computeGhostSuffix('   ')).toBe('');
  });

  it('appends .dot suffix to bare names', () => {
    expect(computeGhostSuffix('foo')).toBe('.dot');
    expect(computeGhostSuffix('  foo  ')).toBe('.dot');
  });

  it('does not append for inputs already ending in .dot', () => {
    expect(computeGhostSuffix('foo.dot')).toBe('');
    expect(computeGhostSuffix('foo.dot.li')).toBe('');
  });

  it('does not append when .dot appears before a path / query / hash', () => {
    expect(computeGhostSuffix('foo.dot/bar')).toBe('');
    expect(computeGhostSuffix('foo.dot?x=1')).toBe('');
    expect(computeGhostSuffix('foo.dot#frag')).toBe('');
    expect(computeGhostSuffix('foo.dot.li/bar')).toBe('');
  });

  it('does not append for http(s) URLs', () => {
    expect(computeGhostSuffix('http://example.com')).toBe('');
    expect(computeGhostSuffix('https://example.com')).toBe('');
    expect(computeGhostSuffix('HTTPS://EXAMPLE.COM')).toBe('');
  });

  it('does not append for localhost / 127.0.0.1', () => {
    expect(computeGhostSuffix('localhost')).toBe('');
    expect(computeGhostSuffix('localhost:3000')).toBe('');
    expect(computeGhostSuffix('127.0.0.1')).toBe('');
    expect(computeGhostSuffix('127.0.0.1:8080/foo')).toBe('');
  });

  it('appends for inputs that contain .dot but not as a suffix', () => {
    expect(computeGhostSuffix('foo.dotli')).toBe('.dot');
  });
});
