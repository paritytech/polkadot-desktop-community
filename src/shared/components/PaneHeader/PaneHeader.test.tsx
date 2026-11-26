// @vitest-environment happy-dom

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { TranslationProvider } from '@/shared/translation';

import { PaneHeader } from './PaneHeader';

function renderPaneHeader() {
  return render(
    <TranslationProvider>
      <PaneHeader subtitle="Subtitle" actions={<button type="button">Expand</button>}>
        A very long room name
      </PaneHeader>
    </TranslationProvider>,
  );
}

describe('PaneHeader', () => {
  it('renders the actions after the title', () => {
    renderPaneHeader();

    const title = screen.getByText('A very long room name');
    const action = screen.getByRole('button', { name: 'Expand' });

    expect(title.compareDocumentPosition(action) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('truncates the title and the subtitle', () => {
    renderPaneHeader();

    expect(screen.getByText('A very long room name')).toHaveClass('truncate');
    expect(screen.getByText('Subtitle')).toHaveClass('truncate');
  });
});
