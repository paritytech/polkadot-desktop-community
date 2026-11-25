// @vitest-environment happy-dom

import { act, render, waitFor } from '@testing-library/react';
import { BehaviorSubject, of } from 'rxjs';
import { afterEach, describe, expect, it } from 'vitest';

import { type ResolvedTheme, type Theme, themeResource } from '@/domains/application';

import { ThemeSyncer } from './ThemeSyncer';

const themeOf = (variant: ResolvedTheme): Theme => ({ preference: variant, variant, name: 'berlin' });

afterEach(() => {
  document.documentElement.classList.remove('dark');
  document.documentElement.style.colorScheme = '';
});

describe('ThemeSyncer', () => {
  it('binds the dark class and the host color-scheme to a dark resolved theme', async () => {
    themeResource.instead(() => of(themeOf('dark')));

    render(<ThemeSyncer />);

    await waitFor(() => expect(document.documentElement.style.colorScheme).toBe('dark'));
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('removes the dark class when the resolved theme turns light', async () => {
    const theme$ = new BehaviorSubject<Theme>(themeOf('dark'));
    themeResource.instead(() => theme$);

    render(<ThemeSyncer />);
    await waitFor(() => expect(document.documentElement.classList.contains('dark')).toBe(true));

    act(() => theme$.next(themeOf('light')));

    await waitFor(() => expect(document.documentElement.style.colorScheme).toBe('light'));
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });
});
