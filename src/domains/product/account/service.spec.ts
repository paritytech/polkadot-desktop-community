import { describe, expect, it } from 'vitest';

import { productAccountService } from './service';

describe('productAccountService.normalizeProductAccountId', () => {
  it('strips the app executable subname down to the base name', () => {
    expect(productAccountService.normalizeProductAccountId(['app.polka.dot', 0])).toEqual(['polka.dot', 0]);
  });

  it('strips the widget and worker executable subnames', () => {
    expect(productAccountService.normalizeProductAccountId(['widget.polka.dot', 3])).toEqual(['polka.dot', 3]);
    expect(productAccountService.normalizeProductAccountId(['worker.polka.dot', 7])).toEqual(['polka.dot', 7]);
  });

  it('matches the executable label case-insensitively', () => {
    expect(productAccountService.normalizeProductAccountId(['App.polka.dot', 0])).toEqual(['polka.dot', 0]);
  });

  it('preserves a multi-label base name after stripping', () => {
    expect(productAccountService.normalizeProductAccountId(['app.foo.bar.dot', 1])).toEqual(['foo.bar.dot', 1]);
  });

  it('leaves a bare base name untouched', () => {
    expect(productAccountService.normalizeProductAccountId(['polka.dot', 0])).toEqual(['polka.dot', 0]);
  });

  it('does not strip when no valid base name would remain (product literally named "app")', () => {
    expect(productAccountService.normalizeProductAccountId(['app.dot', 0])).toEqual(['app.dot', 0]);
  });

  it('leaves non-.dot identifiers (e.g. localhost) unchanged', () => {
    expect(productAccountService.normalizeProductAccountId(['localhost:3000', 0])).toEqual(['localhost:3000', 0]);
  });

  it('preserves the derivation index', () => {
    expect(productAccountService.normalizeProductAccountId(['app.polka.dot', 42])).toEqual(['polka.dot', 42]);
  });
});
