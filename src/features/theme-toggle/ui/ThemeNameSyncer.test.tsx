// @vitest-environment happy-dom

import { act, render, waitFor } from '@testing-library/react';
import { BehaviorSubject, of } from 'rxjs';
import { afterEach, describe, expect, it } from 'vitest';

import { type Theme, themeResource } from '@/domains/application';

import { ThemeNameSyncer } from './ThemeNameSyncer';

afterEach(() => {
  delete document.documentElement.dataset['theme'];
});

describe('ThemeNameSyncer', () => {
  it('writes the theme name on the root element', async () => {
    themeResource.instead(() => of({ preference: 'dark', variant: 'dark', name: 'tokyo' }));

    render(<ThemeNameSyncer />);

    await waitFor(() => expect(document.documentElement.dataset['theme']).toBe('tokyo'));
  });

  it('follows a change of the theme name', async () => {
    const theme$ = new BehaviorSubject<Theme>({ preference: 'dark', variant: 'dark', name: 'lisbon' });
    themeResource.instead(() => theme$);

    render(<ThemeNameSyncer />);
    await waitFor(() => expect(document.documentElement.dataset['theme']).toBe('lisbon'));

    act(() => theme$.next({ preference: 'dark', variant: 'dark', name: 'malta' }));

    await waitFor(() => expect(document.documentElement.dataset['theme']).toBe('malta'));
  });
});
