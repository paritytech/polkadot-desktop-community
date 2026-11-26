// @vitest-environment happy-dom

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { TEST_IDS } from '@/shared/test-ids';
import { TranslationProvider } from '@/shared/translation';
import { dotNsTldResource } from '@/domains/product';
import { openDotNsUrlSideEffect } from '@/features/browser';
import { resetRound } from '../state/round';
import { inputSurfaceInitialText, inputSurfaceOpen } from '../state/surface';

import { InputSpotlight } from './InputSpotlight';

// The navigation is a DI side effect: a handler registered on it observes the real
// fan-out, so nothing has to stand in for the feature that declares it.
const openDotNsUrl = vi.fn();
openDotNsUrlSideEffect.registerHandler({ available: () => true, body: openDotNsUrl });

const renderSurface = () =>
  render(
    <TranslationProvider>
      <InputSpotlight />
    </TranslationProvider>,
  );

const open = () => act(() => void inputSurfaceOpen.set(true));

// Tab completion and Enter routing both refuse to act on an unsettled suffix, so a
// test that presses either flushes the read first.
const settleTld = () => waitFor(() => expect(Object.keys(dotNsTldResource.snapshot()).length).toBeGreaterThan(0));

const type = (text: string) => {
  fireEvent.change(screen.getByTestId(TEST_IDS.inputModalityInput), { target: { value: text } });
};

afterEach(() => {
  // Without this a previous test's navigation satisfies a later assertion — which
  // is what let "Enter does nothing on a bare name" pass unnoticed.
  openDotNsUrl.mockClear();
  cleanup();
  resetRound();
});

describe('InputSpotlight', () => {
  it('renders nothing while closed', () => {
    renderSurface();

    expect(screen.queryByTestId(TEST_IDS.inputModalitySurface)).toBeNull();
  });

  it('opens on whatever the address bar was showing', () => {
    act(() => void inputSurfaceInitialText.set('browse.dot/apps'));
    renderSurface();
    open();

    expect(screen.getByTestId(TEST_IDS.inputModalityInput)).toHaveValue('browse.dot/apps');
  });

  it('navigates on Enter without waiting for the debounce', async () => {
    renderSurface();
    open();
    await settleTld();
    type('browse.dot');
    // Deliberately no settle: the navigation must not depend on a round having
    // landed, or a fast typist gets nothing. It does wait on the network's TLD —
    // the name cannot be parsed without knowing the suffix — which is one cached
    // read, not the debounce.
    fireEvent.keyDown(screen.getByTestId(TEST_IDS.inputModalityInput), { key: 'Enter' });

    await waitFor(() => expect(openDotNsUrl).toHaveBeenCalledWith(expect.objectContaining({ identifier: 'browse.dot' })));
  });

  it('accepts the ghost completion on Enter', async () => {
    renderSurface();
    open();
    await settleTld();
    type('hackm3');

    fireEvent.keyDown(screen.getByTestId(TEST_IDS.inputModalityInput), { key: 'Enter' });

    await waitFor(() => expect(openDotNsUrl).toHaveBeenCalledWith(expect.objectContaining({ identifier: 'hackm3.dot' })));
  });

  it('completes the network suffix on Tab', async () => {
    renderSurface();
    open();
    await settleTld();
    type('hackm3');

    fireEvent.keyDown(screen.getByTestId(TEST_IDS.inputModalityInput), { key: 'Tab' });

    await waitFor(() => expect(screen.getByTestId(TEST_IDS.inputModalityInput)).toHaveValue('hackm3.dot'));
  });

  it('offers no completion until the TLD is known', async () => {
    // Tab writes the suffix into the field and Enter routes that text against the
    // settled TLD, so completing under the fallback leaves a name that resolves on
    // no network and an Enter that silently does nothing.
    dotNsTldResource.instead(() => new Promise<string>(() => {}));
    renderSurface();
    open();
    type('hackm3');

    fireEvent.keyDown(screen.getByTestId(TEST_IDS.inputModalityInput), { key: 'Tab' });

    await waitFor(() => expect(screen.getByTestId(TEST_IDS.inputModalityInput)).toHaveValue('hackm3'));
  });

  // The surface unmounts when it closes and `inputSurfaceOpen` outlives it, so a
  // TLD read that lands after the user reopened the surface must not close the one
  // now on screen — opening several tabs in a row is exactly that sequence.
  it('does not close a reopened surface when an earlier navigation settles late', async () => {
    // Hold the TLD answer open so it lands after the reopen. The navigation resolves
    // the TLD a second time on its way through `openProduct`, so stop deferring as the
    // held answer lands — otherwise the chain stalls on a promise nothing releases.
    let deferred = true;
    let releaseTld: (value: string) => void = () => {};
    dotNsTldResource.instead(() => (deferred ? new Promise<string>(resolve => (releaseTld = resolve)) : '.dot'));

    renderSurface();
    open();
    type('browse.dot');
    fireEvent.keyDown(screen.getByTestId(TEST_IDS.inputModalityInput), { key: 'Enter' });

    // That opening goes away before its read answers, and a new one takes its place.
    act(() => void inputSurfaceOpen.set(false));
    act(() => void inputSurfaceOpen.set(true));
    expect(screen.getByTestId(TEST_IDS.inputModalitySurface)).toBeInTheDocument();

    await act(async () => {
      deferred = false;
      releaseTld('.dot');
    });
    await waitFor(() => expect(openDotNsUrl).toHaveBeenCalled());

    expect(screen.queryByTestId(TEST_IDS.inputModalitySurface)).toBeInTheDocument();
  });

  it('closes on Escape', async () => {
    renderSurface();
    open();
    expect(screen.getByTestId(TEST_IDS.inputModalitySurface)).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByTestId(TEST_IDS.inputModalitySurface)).toBeNull());
  });

  it('closes when focus moves outside it, as a press that reaches the product webview does', async () => {
    const outside = document.createElement('button');
    document.body.append(outside);
    renderSurface();
    open();

    act(() => outside.focus());

    await waitFor(() => expect(screen.queryByTestId(TEST_IDS.inputModalitySurface)).toBeNull());
    outside.remove();
  });

  it('stays open while focus moves inside it', () => {
    renderSurface();
    open();

    act(() => screen.getByTestId(TEST_IDS.inputModalityScanButton).focus());

    expect(screen.getByTestId(TEST_IDS.inputModalitySurface)).toBeInTheDocument();
  });
});
