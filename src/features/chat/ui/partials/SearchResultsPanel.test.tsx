// @vitest-environment happy-dom

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { TranslationProvider } from '@/shared/translation';

import { SearchResultsPanel } from './SearchResultsPanel';

const renderEmptyPanel = (searchError: string | null) =>
  render(
    <TranslationProvider>
      <SearchResultsPanel
        query="alice"
        sessions={[]}
        contactResults={[]}
        messageResults={[]}
        connectedIds={new Set()}
        contactsDisabled={false}
        pending={false}
        searchError={searchError}
        onSelectSession={vi.fn()}
        onSelectContact={vi.fn()}
        onSelectMessage={vi.fn()}
      />
    </TranslationProvider>,
  );

describe('SearchResultsPanel', () => {
  it('titles the empty state with the search error instead of reporting no results', () => {
    renderEmptyPanel('Search failed');

    expect(screen.getByRole('heading', { name: 'Search failed' })).toBeTruthy();
    expect(screen.queryByText(/No results found/)).toBeNull();
  });

  it('reports no results when the search did not fail', () => {
    renderEmptyPanel(null);

    expect(screen.getByRole('heading', { name: 'No results found for "alice"' })).toBeTruthy();
  });
});
