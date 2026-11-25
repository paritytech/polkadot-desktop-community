// @vitest-environment happy-dom

import { render, waitFor } from '@testing-library/react';
import { of } from 'rxjs';
import { afterEach, describe, expect, it } from 'vitest';

import { type ResolvedTheme, themeResource } from '@/domains/application';

import { ThemeSyncer } from './ThemeSyncer';

const showVariant = (variant: ResolvedTheme) => {
  themeResource.instead(() => of({ preference: variant, variant, name: 'berlin' }));
};

afterEach(() => {
  document.documentElement.classList.remove('dark');
  document.documentElement.style.colorScheme = '';
});

describe('ThemeSyncer', () => {
  it('binds the dark class and the host color-scheme to a dark resolved theme', async () => {
    showVariant('dark');

    render(<ThemeSyncer />);

    await waitFor(() => expect(document.documentElement.style.colorScheme).toBe('dark'));
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('clears the dark class for a light resolved theme', async () => {
    showVariant('light');

    render(<ThemeSyncer />);

    await waitFor(() => expect(document.documentElement.style.colorScheme).toBe('light'));
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });
});
