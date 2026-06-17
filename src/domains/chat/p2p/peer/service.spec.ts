import { describe, expect, it } from 'vitest';

import { type SearchResult } from '../types';

import { peerSearchService } from './service';

const result = (candidateAccountId: string, username: string): SearchResult => ({
  candidateAccountId,
  username,
  status: 'ASSIGNED',
});

describe('peerSearchService.excludeSelfFromSearchResults', () => {
  it('drops the entry whose candidateAccountId matches the current user', () => {
    const results = [result('self-acc', 'me'), result('peer-acc', 'alice')];

    const filtered = peerSearchService.excludeSelfFromSearchResults(results, 'self-acc');

    expect(filtered).toEqual([result('peer-acc', 'alice')]);
  });

  it('keeps every entry when none matches the current user', () => {
    const results = [result('peer-1', 'alice'), result('peer-2', 'bob')];

    expect(peerSearchService.excludeSelfFromSearchResults(results, 'self-acc')).toEqual(results);
  });

  it('drops all entries when only self matches', () => {
    const results = [result('self-acc', 'me')];

    expect(peerSearchService.excludeSelfFromSearchResults(results, 'self-acc')).toEqual([]);
  });
});
