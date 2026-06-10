import { isLocalhostUrl, normalizeLocalhostUrl, parseLocalhostUrl } from './localhost';

describe('isLocalhostUrl', () => {
  test('matches localhost without protocol', () => {
    expect(isLocalhostUrl('localhost:3000')).toBe(true);
  });

  test('matches localhost with http protocol', () => {
    expect(isLocalhostUrl('http://localhost:3000')).toBe(true);
  });

  test('matches localhost without port', () => {
    expect(isLocalhostUrl('localhost')).toBe(true);
  });

  test('rejects non-localhost URLs', () => {
    expect(isLocalhostUrl('example.com')).toBe(false);
    expect(isLocalhostUrl('https://example.com')).toBe(false);
  });
});

describe('normalizeLocalhostUrl', () => {
  test('prepends http:// when missing', () => {
    expect(normalizeLocalhostUrl('localhost:3000')).toBe('http://localhost:3000');
  });

  test('keeps existing http://', () => {
    expect(normalizeLocalhostUrl('http://localhost:3000')).toBe('http://localhost:3000');
  });
});

describe('parseLocalhostUrl', () => {
  test('parses localhost with port', () => {
    expect(parseLocalhostUrl('localhost:3000')).toEqual({
      identifier: 'localhost:3000',
      pathname: '',
    });
  });

  test('parses localhost with pathname', () => {
    expect(parseLocalhostUrl('localhost:3000/n')).toEqual({
      identifier: 'localhost:3000',
      pathname: 'n',
    });
  });

  test('preserves query parameters', () => {
    expect(parseLocalhostUrl('localhost:3000/n?id=doc-123')).toEqual({
      identifier: 'localhost:3000',
      pathname: 'n?id=doc-123',
    });
  });

  test('preserves hash fragment', () => {
    expect(parseLocalhostUrl('localhost:3000/n#key=abc')).toEqual({
      identifier: 'localhost:3000',
      pathname: 'n#key=abc',
    });
  });

  test('preserves query parameters and hash fragment together', () => {
    const url = 'localhost:3000/n?id=doc-1769102172266-u4n7nz09j#key=1jPCSPzj2f_h9Jn3mDo-Vw&pk=84b56c19aa2098440f8a';
    expect(parseLocalhostUrl(url)).toEqual({
      identifier: 'localhost:3000',
      pathname: 'n?id=doc-1769102172266-u4n7nz09j#key=1jPCSPzj2f_h9Jn3mDo-Vw&pk=84b56c19aa2098440f8a',
    });
  });

  test('works with http:// prefix', () => {
    expect(parseLocalhostUrl('http://localhost:3000/path?q=1#h=2')).toEqual({
      identifier: 'localhost:3000',
      pathname: 'path?q=1#h=2',
    });
  });

  test('returns null for non-localhost URLs', () => {
    expect(parseLocalhostUrl('https://example.com')).toBeNull();
  });

  test('returns null for invalid URLs', () => {
    expect(parseLocalhostUrl('not a url at all')).toBeNull();
  });
});
