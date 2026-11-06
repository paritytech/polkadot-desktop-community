import { describe, expect, it } from 'vitest';

import { dotNsService, isLocalhostUrl, normalizeLocalhostUrl, parseLocalhostUrl } from './service';

// Every TLD-taking helper is exercised under two networks, so a
// suffix that leaked back into the implementation fails on the second one.
describe.each(['.dot', '.paseo'])('dotNS name helpers on %s', tld => {
  describe('baseNameOf', () => {
    it('appends the TLD to a bare label', () => {
      expect(dotNsService.baseNameOf('hackm3', tld)).toBe(`hackm3${tld}`);
    });

    it('returns full base names unchanged', () => {
      expect(dotNsService.baseNameOf(`hackm3${tld}`, tld)).toBe(`hackm3${tld}`);
    });

    it('lowercases the input', () => {
      expect(dotNsService.baseNameOf(`HACKm3${tld.toUpperCase()}`, tld)).toBe(`hackm3${tld}`);
    });

    it('trims whitespace', () => {
      expect(dotNsService.baseNameOf(`  hackm3${tld}  `, tld)).toBe(`hackm3${tld}`);
    });
  });

  describe('isSameBaseName', () => {
    it('matches case variants of the same name', () => {
      expect(dotNsService.isSameBaseName(`Hackm3${tld}`, `hackm3${tld}`, tld)).toBe(true);
    });

    it('matches a raw identifier against its normalized base name', () => {
      expect(dotNsService.isSameBaseName('localhost:5173', `localhost:5173${tld}`, tld)).toBe(true);
    });

    it('rejects different names', () => {
      expect(dotNsService.isSameBaseName(`alpha${tld}`, `beta${tld}`, tld)).toBe(false);
    });
  });

  describe('labelOf', () => {
    it('names a product by the label just above its TLD', () => {
      expect(dotNsService.labelOf(`caller${tld}`)).toBe('caller');
    });

    it('names an executable subname by its product', () => {
      expect(dotNsService.labelOf(`app.Caller${tld}`)).toBe('caller');
    });

    it('accepts a bare label', () => {
      expect(dotNsService.labelOf('caller')).toBe('caller');
    });

    it('names an id from another network by its product, not its TLD', () => {
      expect(dotNsService.labelOf(`caller${tld === '.dot' ? '.paseo' : '.dot'}`)).toBe('caller');
    });
  });

  describe('toDisplayName', () => {
    it('strips a trailing TLD', () => {
      expect(dotNsService.toDisplayName(`hackm3${tld}`, tld)).toBe('hackm3');
    });

    it('leaves a name without a trailing TLD unchanged', () => {
      expect(dotNsService.toDisplayName('HackM3', tld)).toBe('HackM3');
    });

    it('only strips the final TLD, not the gateway suffix', () => {
      expect(dotNsService.toDisplayName(`hackm3${tld}.li`, tld)).toBe(`hackm3${tld}.li`);
    });

    it('leaves another network TLD alone', () => {
      expect(dotNsService.toDisplayName('hackm3.example', tld)).toBe('hackm3.example');
    });
  });

  describe('toShortLabel', () => {
    it('keeps a name within the length cap as-is', () => {
      expect(dotNsService.toShortLabel(`a${tld}`, tld)).toBe(`a${tld}`);
    });

    it('truncates a long name with an ellipsis', () => {
      expect(dotNsService.toShortLabel(`verylongproduct${tld}`, tld)).toBe('verylongpr...');
    });

    it('honours a custom max length', () => {
      expect(dotNsService.toShortLabel(`hackm3${tld}`, tld, 4)).toBe('hack...');
    });
  });

  describe('isDotDomain', () => {
    it('returns true for a name under the network TLD', () => {
      expect(dotNsService.isDotDomain(`mytestapp${tld}`, tld)).toBe(true);
    });

    it('returns true for the gateway alias', () => {
      expect(dotNsService.isDotDomain(`mytestapp${tld}.li`, tld)).toBe(true);
    });

    it('returns false for an unrelated domain', () => {
      expect(dotNsService.isDotDomain('example.com', tld)).toBe(false);
    });

    it('returns false for another network TLD', () => {
      expect(dotNsService.isDotDomain('mytestapp.example', tld)).toBe(false);
    });
  });

  describe('isProductIdentifier', () => {
    it('accepts a name under the network TLD', () => {
      expect(dotNsService.isProductIdentifier(`mytestapp${tld}`, tld)).toBe(true);
    });

    it('accepts a localhost identifier', () => {
      expect(dotNsService.isProductIdentifier('localhost:3000', tld)).toBe(true);
    });

    it('rejects an unrelated domain', () => {
      expect(dotNsService.isProductIdentifier('example.com', tld)).toBe(false);
    });
  });

  describe('parseDotNsDomain', () => {
    it('parses a bare name', () => {
      expect(dotNsService.parseDotNsDomain(`mytestapp${tld}`, tld)).toEqual({
        identifier: `mytestapp${tld}`,
        pathname: '',
      });
    });

    it('collapses the bare gateway alias', () => {
      expect(dotNsService.parseDotNsDomain(`mytestapp${tld}.li`, tld)).toEqual({
        identifier: `mytestapp${tld}`,
        pathname: '',
      });
    });

    it('parses a name with https protocol', () => {
      expect(dotNsService.parseDotNsDomain(`https://mytestapp${tld}`, tld)).toEqual({
        identifier: `mytestapp${tld}`,
        pathname: '',
      });
    });

    it('parses a name with http protocol', () => {
      expect(dotNsService.parseDotNsDomain(`http://mytestapp${tld}`, tld)).toEqual({
        identifier: `mytestapp${tld}`,
        pathname: '',
      });
    });

    it('parses a name with pathname', () => {
      expect(dotNsService.parseDotNsDomain(`mytestapp${tld}/some/path`, tld)).toEqual({
        identifier: `mytestapp${tld}`,
        pathname: 'some/path',
      });
    });

    it('collapses the gateway alias with pathname', () => {
      expect(dotNsService.parseDotNsDomain(`mytestapp${tld}.li/some/path`, tld)).toEqual({
        identifier: `mytestapp${tld}`,
        pathname: 'some/path',
      });
    });

    it('parses a query on host only (no path segment before ?)', () => {
      expect(dotNsService.parseDotNsDomain(`pr508.faucet${tld}?embed=1`, tld)).toEqual({
        identifier: `pr508.faucet${tld}`,
        pathname: '?embed=1',
      });
    });

    it('parses https with a query on host only', () => {
      expect(dotNsService.parseDotNsDomain(`https://pr508.faucet${tld}?embed=1`, tld)).toEqual({
        identifier: `pr508.faucet${tld}`,
        pathname: '?embed=1',
      });
    });

    it('parses a hash on host only', () => {
      expect(dotNsService.parseDotNsDomain(`pr508.faucet${tld}#section=main`, tld)).toEqual({
        identifier: `pr508.faucet${tld}`,
        pathname: '#section=main',
      });
    });

    it('parses pathname, query and hash together', () => {
      expect(dotNsService.parseDotNsDomain(`pr508.faucet${tld}/nested/path?embed=1#frame=compact`, tld)).toEqual({
        identifier: `pr508.faucet${tld}`,
        pathname: 'nested/path?embed=1#frame=compact',
      });
    });

    it('parses a name from a polkadot:// URL host', () => {
      expect(dotNsService.parseDotNsDomain(`polkadot://currenthost${tld}/mytestapp${tld}`, tld)).toEqual({
        identifier: `currenthost${tld}`,
        pathname: `mytestapp${tld}`,
      });
    });

    it('collapses the gateway alias in a polkadot:// URL host', () => {
      expect(dotNsService.parseDotNsDomain(`polkadot://currenthost${tld}.li/mytestapp${tld}`, tld)).toEqual({
        identifier: `currenthost${tld}`,
        pathname: `mytestapp${tld}`,
      });
    });

    it('parses a polkadot:// URL with a nested path', () => {
      expect(dotNsService.parseDotNsDomain(`polkadot://currenthost${tld}/mytestapp${tld}/settings`, tld)).toEqual({
        identifier: `currenthost${tld}`,
        pathname: `mytestapp${tld}/settings`,
      });
    });

    it('parses a polkadot:// URL with query and hash', () => {
      expect(dotNsService.parseDotNsDomain(`polkadot://currenthost${tld}/mytestapp${tld}?embed=1#frame=compact`, tld)).toEqual({
        identifier: `currenthost${tld}`,
        pathname: `mytestapp${tld}?embed=1#frame=compact`,
      });
    });

    it('parses a polkadot:// URL with a regular path', () => {
      expect(dotNsService.parseDotNsDomain(`polkadot://currenthost${tld}/settings`, tld)).toEqual({
        identifier: `currenthost${tld}`,
        pathname: 'settings',
      });
    });

    // `polkadot://` is not a special scheme, so `URL` keeps the host's case. The core
    // lowercases every product id it is handed, and the host keys state on the id it
    // gets back — an identifier that is not already lowercase splits that state.
    it('lowercases a mixed-case polkadot:// host', () => {
      expect(dotNsService.parseDotNsDomain(`polkadot://CurrentHost${tld.toUpperCase()}/Settings`, tld)).toEqual({
        identifier: `currenthost${tld}`,
        pathname: 'Settings',
      });
    });

    it('returns null for a polkadot:// URL whose host is not under the TLD', () => {
      expect(dotNsService.parseDotNsDomain('polkadot://example.com/settings', tld)).toBeNull();
    });

    it('returns null for an unrelated domain', () => {
      expect(dotNsService.parseDotNsDomain('example.com', tld)).toBeNull();
    });

    it('returns null for a name under another network TLD', () => {
      expect(dotNsService.parseDotNsDomain('mytestapp.example', tld)).toBeNull();
    });

    it('returns null when pathname contains parentheses (router-unsafe)', () => {
      expect(dotNsService.parseDotNsDomain(`localdot${tld}/foo(bar`, tld)).toBeNull();
      expect(dotNsService.parseDotNsDomain(`localdot${tld}/(`, tld)).toBeNull();
    });

    it('returns null when pathname contains spaces (encoded or not)', () => {
      expect(dotNsService.parseDotNsDomain(`localdot${tld}/ (`, tld)).toBeNull();
    });

    it('returns null for invalid percent-encoding in pathname', () => {
      expect(dotNsService.parseDotNsDomain(`mytestapp${tld}/bad%`, tld)).toBeNull();
      expect(dotNsService.parseDotNsDomain(`mytestapp${tld}/bad%zz`, tld)).toBeNull();
    });
  });
});

describe('subnameOf', () => {
  it('prepends the label to the base name', () => {
    expect(dotNsService.subnameOf('hackm3.dot', 'app')).toBe('app.hackm3.dot');
  });

  it('produces widget subname', () => {
    expect(dotNsService.subnameOf('hackm3.dot', 'widget')).toBe('widget.hackm3.dot');
  });

  it('produces worker subname', () => {
    expect(dotNsService.subnameOf('hackm3.dot', 'worker')).toBe('worker.hackm3.dot');
  });
});

describe('generateProductBase', () => {
  it('builds a polkadot:// origin', () => {
    expect(dotNsService.generateProductBase('app.hackm3.dot')).toBe('polkadot://app.hackm3.dot');
  });

  it('encodes each path segment', () => {
    expect(dotNsService.generateProductBase('a b/c d')).toBe('polkadot://a%20b/c%20d');
  });
});

describe('isLocalhostUrl', () => {
  it('matches localhost without protocol', () => {
    expect(isLocalhostUrl('localhost:3000')).toBe(true);
  });

  it('matches localhost with http protocol', () => {
    expect(isLocalhostUrl('http://localhost:3000')).toBe(true);
  });

  it('matches localhost without port', () => {
    expect(isLocalhostUrl('localhost')).toBe(true);
  });

  it('rejects non-localhost URLs', () => {
    expect(isLocalhostUrl('example.com')).toBe(false);
    expect(isLocalhostUrl('https://example.com')).toBe(false);
  });
});

describe('normalizeLocalhostUrl', () => {
  it('prepends http:// when missing', () => {
    expect(normalizeLocalhostUrl('localhost:3000')).toBe('http://localhost:3000');
  });

  it('keeps existing http://', () => {
    expect(normalizeLocalhostUrl('http://localhost:3000')).toBe('http://localhost:3000');
  });
});

describe('parseLocalhostUrl', () => {
  it('parses localhost with port', () => {
    expect(parseLocalhostUrl('localhost:3000')).toEqual({
      identifier: 'localhost:3000',
      pathname: '',
    });
  });

  it('parses localhost with pathname', () => {
    expect(parseLocalhostUrl('localhost:3000/n')).toEqual({
      identifier: 'localhost:3000',
      pathname: 'n',
    });
  });

  it('preserves query parameters', () => {
    expect(parseLocalhostUrl('localhost:3000/n?id=doc-123')).toEqual({
      identifier: 'localhost:3000',
      pathname: 'n?id=doc-123',
    });
  });

  it('preserves hash fragment', () => {
    expect(parseLocalhostUrl('localhost:3000/n#key=abc')).toEqual({
      identifier: 'localhost:3000',
      pathname: 'n#key=abc',
    });
  });

  it('preserves query parameters and hash fragment together', () => {
    const url = 'localhost:3000/n?id=doc-1769102172266-u4n7nz09j#key=1jPCSPzj2f_h9Jn3mDo-Vw&pk=84b56c19aa2098440f8a';
    expect(parseLocalhostUrl(url)).toEqual({
      identifier: 'localhost:3000',
      pathname: 'n?id=doc-1769102172266-u4n7nz09j#key=1jPCSPzj2f_h9Jn3mDo-Vw&pk=84b56c19aa2098440f8a',
    });
  });

  it('works with http:// prefix', () => {
    expect(parseLocalhostUrl('http://localhost:3000/path?q=1#h=2')).toEqual({
      identifier: 'localhost:3000',
      pathname: 'path?q=1#h=2',
    });
  });

  it('returns null for non-localhost URLs', () => {
    expect(parseLocalhostUrl('https://example.com')).toBeNull();
  });

  it('returns null for invalid URLs', () => {
    expect(parseLocalhostUrl('not a url at all')).toBeNull();
  });
});
