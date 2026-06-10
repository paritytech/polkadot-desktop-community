import { dotNsService } from './service';

describe('baseNameOf', () => {
  test('appends .dot to a bare label', () => {
    expect(dotNsService.baseNameOf('hackm3')).toBe('hackm3.dot');
  });

  test('returns full base names unchanged', () => {
    expect(dotNsService.baseNameOf('hackm3.dot')).toBe('hackm3.dot');
  });

  test('lowercases the input', () => {
    expect(dotNsService.baseNameOf('HACKm3.DOT')).toBe('hackm3.dot');
  });

  test('trims whitespace', () => {
    expect(dotNsService.baseNameOf('  hackm3.dot  ')).toBe('hackm3.dot');
  });
});

describe('isSameBaseName', () => {
  test('matches case variants of the same name', () => {
    expect(dotNsService.isSameBaseName('Hackm3.dot', 'hackm3.dot')).toBe(true);
  });

  test('matches a raw identifier against its normalized base name', () => {
    expect(dotNsService.isSameBaseName('localhost:5173', 'localhost:5173.dot')).toBe(true);
  });

  test('rejects different names', () => {
    expect(dotNsService.isSameBaseName('alpha.dot', 'beta.dot')).toBe(false);
  });
});

describe('toDisplayName', () => {
  test('strips a trailing .dot', () => {
    expect(dotNsService.toDisplayName('hackm3.dot')).toBe('hackm3');
  });

  test('leaves a name without a trailing .dot unchanged', () => {
    expect(dotNsService.toDisplayName('HackM3')).toBe('HackM3');
  });

  test('only strips the final .dot, not a .dot.li suffix', () => {
    expect(dotNsService.toDisplayName('hackm3.dot.li')).toBe('hackm3.dot.li');
  });
});

describe('toShortLabel', () => {
  test('keeps a short .dot name as-is', () => {
    expect(dotNsService.toShortLabel('hackm3.dot')).toBe('hackm3.dot');
  });

  test('truncates a long .dot name with an ellipsis', () => {
    expect(dotNsService.toShortLabel('verylongproduct.dot')).toBe('verylongpr...');
  });

  test('honours a custom max length', () => {
    expect(dotNsService.toShortLabel('hackm3.dot', 4)).toBe('hack...');
  });
});

describe('subnameOf', () => {
  test('prepends the label to the base name', () => {
    expect(dotNsService.subnameOf('hackm3.dot', 'app')).toBe('app.hackm3.dot');
  });

  test('produces widget subname', () => {
    expect(dotNsService.subnameOf('hackm3.dot', 'widget')).toBe('widget.hackm3.dot');
  });

  test('produces worker subname', () => {
    expect(dotNsService.subnameOf('hackm3.dot', 'worker')).toBe('worker.hackm3.dot');
  });
});

describe('generateProductBase', () => {
  test('builds a polkadot:// origin', () => {
    expect(dotNsService.generateProductBase('app.hackm3.dot')).toBe('polkadot://app.hackm3.dot');
  });

  test('encodes each path segment', () => {
    expect(dotNsService.generateProductBase('a b/c d')).toBe('polkadot://a%20b/c%20d');
  });
});

describe('parseDotNsDomain', () => {
  test('parses bare .dot domain', () => {
    expect(dotNsService.parseDotNsDomain('mytestapp.dot')).toEqual({
      identifier: 'mytestapp.dot',
      pathname: '',
    });
  });

  test('parses bare .dot.li domain', () => {
    expect(dotNsService.parseDotNsDomain('mytestapp.dot.li')).toEqual({
      identifier: 'mytestapp.dot',
      pathname: '',
    });
  });

  test('parses .dot domain with https protocol', () => {
    expect(dotNsService.parseDotNsDomain('https://mytestapp.dot')).toEqual({
      identifier: 'mytestapp.dot',
      pathname: '',
    });
  });

  test('parses .dot domain with http protocol', () => {
    expect(dotNsService.parseDotNsDomain('http://mytestapp.dot')).toEqual({
      identifier: 'mytestapp.dot',
      pathname: '',
    });
  });

  test('parses .dot domain with pathname', () => {
    expect(dotNsService.parseDotNsDomain('mytestapp.dot/some/path')).toEqual({
      identifier: 'mytestapp.dot',
      pathname: 'some/path',
    });
  });

  test('parses .dot.li domain with pathname', () => {
    expect(dotNsService.parseDotNsDomain('mytestapp.dot.li/some/path')).toEqual({
      identifier: 'mytestapp.dot',
      pathname: 'some/path',
    });
  });

  test('parses .dot domain with query on host only (no path segment before ?)', () => {
    expect(dotNsService.parseDotNsDomain('pr508.faucet.dot?embed=1')).toEqual({
      identifier: 'pr508.faucet.dot',
      pathname: '?embed=1',
    });
  });

  test('parses .dot domain with https and query on host only', () => {
    expect(dotNsService.parseDotNsDomain('https://pr508.faucet.dot?embed=1')).toEqual({
      identifier: 'pr508.faucet.dot',
      pathname: '?embed=1',
    });
  });

  test('parses .dot domain with hash on host only', () => {
    expect(dotNsService.parseDotNsDomain('pr508.faucet.dot#section=main')).toEqual({
      identifier: 'pr508.faucet.dot',
      pathname: '#section=main',
    });
  });

  test('parses .dot domain with pathname, query and hash', () => {
    expect(dotNsService.parseDotNsDomain('pr508.faucet.dot/nested/path?embed=1#frame=compact')).toEqual({
      identifier: 'pr508.faucet.dot',
      pathname: 'nested/path?embed=1#frame=compact',
    });
  });

  test('parses .dot domain from polkadot:// URL host', () => {
    expect(dotNsService.parseDotNsDomain('polkadot://currenthost.dot/mytestapp.dot')).toEqual({
      identifier: 'currenthost.dot',
      pathname: 'mytestapp.dot',
    });
  });

  test('parses .dot.li domain from polkadot:// URL host', () => {
    expect(dotNsService.parseDotNsDomain('polkadot://currenthost.dot.li/mytestapp.dot')).toEqual({
      identifier: 'currenthost.dot',
      pathname: 'mytestapp.dot',
    });
  });

  test('parses .dot domain with path from polkadot:// URL', () => {
    expect(dotNsService.parseDotNsDomain('polkadot://currenthost.dot/mytestapp.dot/settings')).toEqual({
      identifier: 'currenthost.dot',
      pathname: 'mytestapp.dot/settings',
    });
  });

  test('parses .dot domain with query/hash from polkadot:// URL', () => {
    expect(dotNsService.parseDotNsDomain('polkadot://currenthost.dot/mytestapp.dot?embed=1#frame=compact')).toEqual({
      identifier: 'currenthost.dot',
      pathname: 'mytestapp.dot?embed=1#frame=compact',
    });
  });

  test('parses .dot domain from polkadot:// URL with regular path', () => {
    expect(dotNsService.parseDotNsDomain('polkadot://currenthost.dot/settings')).toEqual({
      identifier: 'currenthost.dot',
      pathname: 'settings',
    });
  });

  test('returns null for polkadot:// URL without .dot host', () => {
    expect(dotNsService.parseDotNsDomain('polkadot://example.com/settings')).toBeNull();
  });

  test('returns null for non-.dot domain', () => {
    expect(dotNsService.parseDotNsDomain('example.com')).toBeNull();
  });

  test('returns null when pathname contains parentheses (router-unsafe)', () => {
    expect(dotNsService.parseDotNsDomain('localdot.dot/foo(bar')).toBeNull();
    expect(dotNsService.parseDotNsDomain('localdot.dot/(')).toBeNull();
  });

  test('returns null when pathname contains spaces (encoded or not)', () => {
    expect(dotNsService.parseDotNsDomain('localdot.dot/ (')).toBeNull();
  });

  test('returns null for invalid percent-encoding in pathname', () => {
    expect(dotNsService.parseDotNsDomain('mytestapp.dot/bad%')).toBeNull();
    expect(dotNsService.parseDotNsDomain('mytestapp.dot/bad%zz')).toBeNull();
  });
});

describe('isDotDomain', () => {
  test('returns true for .dot domain', () => {
    expect(dotNsService.isDotDomain('mytestapp.dot')).toBe(true);
  });

  test('returns true for .dot.li domain', () => {
    expect(dotNsService.isDotDomain('mytestapp.dot.li')).toBe(true);
  });

  test('returns false for non-.dot domain', () => {
    expect(dotNsService.isDotDomain('example.com')).toBe(false);
  });
});
