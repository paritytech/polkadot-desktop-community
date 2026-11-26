// @vitest-environment happy-dom
import { useDirection } from '@radix-ui/react-direction';
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { TranslationProvider } from './TranslationProvider';
import { useTranslation } from './useTranslation';

// Every shipped catalog now has the full key set, so none of them can exercise the English
// underlay any more. The partial catalog is simulated here instead of relying on whichever
// language happens to be untranslated — that dependency is what made this case fragile.
vi.mock('./locales/de.json', () => ({
  default: { feature: { languageSettings: { title: 'Sprache' } } },
}));

const Probe = () => {
  const { t, locale } = useTranslation();

  return (
    <>
      <span data-testid="text">{t('feature.settings.title')}</span>
      <span data-testid="locale">{locale}</span>
    </>
  );
};

// Reads the direction the way every Radix primitive does — through context, not the DOM.
const RadixProbe = () => <span data-testid="radix-dir">{useDirection()}</span>;

// The provider writes to the shared document element, and happy-dom keeps it between cases.
afterEach(() => {
  document.documentElement.removeAttribute('dir');
  document.documentElement.removeAttribute('lang');
});

describe('TranslationProvider', () => {
  it('renders English when no locale is requested', () => {
    render(
      <TranslationProvider>
        <Probe />
      </TranslationProvider>,
    );

    expect(screen.getByTestId('text')).toHaveTextContent('Settings');
  });

  // The only coverage of the English underlay in withEnglishFallback. `de` is mocked above to a
  // catalog holding one key, standing in for any catalog that lags behind en.json.
  it('falls back to English for a key the catalog is missing', async () => {
    render(
      <TranslationProvider locale="de">
        <Probe />
      </TranslationProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('locale')).toHaveTextContent('de'));

    // The whole point: an untranslated key renders English, never the raw message id.
    expect(screen.getByTestId('text')).toHaveTextContent('Settings');
    expect(screen.getByTestId('text')).not.toHaveTextContent('feature.settings.title');
  });

  it('renders the translated catalog for a locale that has one', async () => {
    render(
      <TranslationProvider locale="es">
        <Probe />
      </TranslationProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('text')).toHaveTextContent('Ajustes'));
  });

  it('never renders an empty tree while a catalog loads', () => {
    render(
      <TranslationProvider locale="ja">
        <Probe />
      </TranslationProvider>,
    );

    // Synchronously, before the dynamic import resolves.
    expect(screen.getByTestId('text')).toHaveTextContent('Settings');
  });
});

describe('TranslationProvider document direction', () => {
  it('defaults to ltr/en when no locale is requested', () => {
    render(
      <TranslationProvider>
        <Probe />
      </TranslationProvider>,
    );

    expect(document.documentElement.dir).toBe('ltr');
    expect(document.documentElement.lang).toBe('en');
  });

  it('switches the document to rtl for Arabic', async () => {
    render(
      <TranslationProvider locale="ar">
        <Probe />
      </TranslationProvider>,
    );

    await waitFor(() => expect(document.documentElement.dir).toBe('rtl'));
    expect(document.documentElement.lang).toBe('ar');
  });

  // Direction has to follow the locale both ways — an rtl document that never returns to ltr is the
  // failure a one-way test would miss.
  it('returns to ltr when leaving Arabic', async () => {
    const { rerender } = render(
      <TranslationProvider locale="ar">
        <Probe />
      </TranslationProvider>,
    );

    await waitFor(() => expect(document.documentElement.dir).toBe('rtl'));

    rerender(
      <TranslationProvider locale="fr">
        <Probe />
      </TranslationProvider>,
    );

    await waitFor(() => expect(document.documentElement.dir).toBe('ltr'));
    expect(document.documentElement.lang).toBe('fr');
  });

  // Guards the D1 decision: direction comes from the rendering locale, not the requested one, so the
  // document must not be rtl while English text is still on screen mid-load.
  it('stays ltr until the Arabic catalog has actually replaced the English messages', () => {
    render(
      <TranslationProvider locale="ar">
        <Probe />
      </TranslationProvider>,
    );

    expect(screen.getByTestId('text')).toHaveTextContent('Settings');
    expect(document.documentElement.dir).toBe('ltr');
  });

  // The `dir` attribute alone would not reach the Radix primitives the local components wrap — dropdown alignment,
  // select/tabs arrow-key direction and scroll-area all read this context. Without this case the
  // DirectionProvider could be deleted and every other test would still pass.
  it('feeds the direction to Radix context, not just the document', async () => {
    render(
      <TranslationProvider locale="ar">
        <RadixProbe />
      </TranslationProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('radix-dir')).toHaveTextContent('rtl'));
  });
});
