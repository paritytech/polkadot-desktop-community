// @vitest-environment happy-dom

import { ThemeProvider, berlinTheme } from '@novasamatech/tr-ui';
import { act, render, waitFor } from '@testing-library/react';
import { BehaviorSubject, of } from 'rxjs';
import { afterEach, describe, expect, it } from 'vitest';

import { type ResolvedTheme, type ThemeName, themeResource } from '@/domains/application';

import { ThemeNameSyncer } from './ThemeNameSyncer';

type ThemeState = { preference: ResolvedTheme; variant: ResolvedTheme; name: ThemeName };

const renderSyncer = () =>
  render(
    <ThemeProvider theme={berlinTheme}>
      <ThemeNameSyncer />
    </ThemeProvider>,
  );

afterEach(() => {
  delete document.documentElement.dataset['theme'];
});

describe('ThemeNameSyncer', () => {
  it('writes the theme name on the root element', async () => {
    themeResource.instead(() => of({ preference: 'dark', variant: 'dark', name: 'tokyo' }));

    renderSyncer();

    await waitFor(() => expect(document.documentElement.dataset['theme']).toBe('tokyo'));
  });

  it('follows a change of the theme name', async () => {
    const theme$ = new BehaviorSubject<ThemeState>({ preference: 'dark', variant: 'dark', name: 'lisbon' });
    themeResource.instead(() => theme$);

    renderSyncer();
    await waitFor(() => expect(document.documentElement.dataset['theme']).toBe('lisbon'));

    act(() => theme$.next({ preference: 'dark', variant: 'dark', name: 'malta' }));

    await waitFor(() => expect(document.documentElement.dataset['theme']).toBe('malta'));
  });

  it('writes a name it has no palette for', async () => {
    themeResource.instead(() => of({ preference: 'dark', variant: 'dark', name: 'unknown' as ThemeName }));

    renderSyncer();

    await waitFor(() => expect(document.documentElement.dataset['theme']).toBe('unknown'));
  });
});
