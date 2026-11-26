// @vitest-environment happy-dom

import { render, screen } from '@testing-library/react';
import { of } from 'rxjs';
import { describe, expect, it } from 'vitest';

import { TranslationProvider } from '@/shared/translation';
import { THEME_NAMES, themeResource } from '@/domains/application';
import { THEME_SWATCHES } from '../constants';

import { ThemePicker } from './ThemePicker';

const renderPicker = () =>
  render(
    <TranslationProvider>
      <ThemePicker />
    </TranslationProvider>,
  );

describe('ThemePicker', () => {
  it('draws each palette as its light and dark surface halves', async () => {
    renderPicker();

    const radios = await screen.findAllByRole('radio');
    expect(radios).toHaveLength(THEME_NAMES.length);

    for (const [index, radio] of radios.entries()) {
      const swatch = THEME_SWATCHES[THEME_NAMES[index]!];
      const halves = radio.querySelectorAll<HTMLElement>('[style]');
      expect(halves).toHaveLength(2);
      expect(halves[0]).toHaveStyle({ backgroundColor: swatch.light });
      expect(halves[1]).toHaveStyle({ backgroundColor: swatch.dark });
    }
  });

  it('shows the check on the selected palette only', async () => {
    themeResource.instead(() => of({ preference: 'dark', variant: 'dark', name: 'lisbon' }));
    renderPicker();

    const selected = await screen.findByRole('radio', { checked: true });
    expect(selected.querySelector('svg')).not.toBeNull();
    for (const radio of screen.getAllByRole('radio', { checked: false })) {
      expect(radio.querySelector('svg')).toBeNull();
    }
    expect(screen.getAllByRole('radio', { checked: true })).toHaveLength(1);
  });
});
