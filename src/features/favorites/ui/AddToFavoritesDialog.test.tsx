// @vitest-environment happy-dom

import { type AppListing } from '@parity/browse-sdk';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { type ComponentProps } from 'react';
import { IntlProvider, ReactIntlErrorCode } from 'react-intl';
import { BehaviorSubject } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Empty test catalog: ignore the expected missing-translation noise (formatjs#619), keep real errors.
const onIntlError: ComponentProps<typeof IntlProvider>['onError'] = err => {
  if (err.code !== ReactIntlErrorCode.MISSING_TRANSLATION) console.error(err);
};

// A catalog row as `browseService` actually reads it: the real
// `productPreviewFromListing` builds the preview out of `manifest`, so a fixture
// carrying only `label` was shaped to the old stand-in rather than to the type.
const listing = (label: string): AppListing =>
  ({
    label,
    manifest: { displayName: label.replace(/\.dot$/, ''), description: '', icon: { cid: '', format: 'png' } },
  }) as unknown as AppListing;

import {
  type MainDashboardLayoutSnapshot,
  FAVORITES_FOLDER_ID,
  foldersUseCase,
  mainDashboardLayoutResource,
} from '@/domains/application';
import { publishedAppListingsResource } from '@/domains/product';

import { AddToFavoritesDialog } from './AddToFavoritesDialog';

// Both folder writes are use-case methods on a plain object, spied in place: the hooks
// the dialog calls are `useAction` wrappers over them, so the real hooks run.
const addToFavorites = vi.spyOn(foldersUseCase, 'addToFavorites').mockResolvedValue({ ok: true });
const removeItemFromFolder = vi.spyOn(foldersUseCase, 'removeItemFromFolder').mockResolvedValue(true);

// A subject rather than a fixed value: one test flips membership while the dialog
// stays open, and the live subscription pushes that through without a rerender.
const layout$ = new BehaviorSubject<MainDashboardLayoutSnapshot | null>(null);

const snapshotWith = (ids: string[]): MainDashboardLayoutSnapshot => ({
  pages: [[{ i: FAVORITES_FOLDER_ID, x: 0, y: 0, w: 1, h: 1, payload: { kind: 'folder' as const, items: ids } }]],
  activePageIndex: 0,
});

const catalog = vi.fn(() => [listing('coinflip.dot'), listing('staking.dot')]);

const renderDialog = () =>
  render(
    <IntlProvider locale="en" messages={{}} onError={onIntlError}>
      <AddToFavoritesDialog isOpen onClose={vi.fn()} />
    </IntlProvider>,
  );

describe('AddToFavoritesDialog', () => {
  beforeEach(() => {
    addToFavorites.mockClear();
    removeItemFromFolder.mockClear();
    catalog.mockClear();
    layout$.next(snapshotWith(['staking.dot']));
    mainDashboardLayoutResource.instead(() => layout$);
    publishedAppListingsResource.instead(catalog);
  });

  it('excludes already-favorite products from the list at open', async () => {
    renderDialog();
    // staking is already a favorite -> filtered out; coinflip (non-favorite) stays.
    expect(await screen.findByText('coinflip')).toBeInTheDocument();
    expect(screen.queryByText('staking')).not.toBeInTheDocument();
  });

  it('adds a candidate product to favorites (and it stays in the list)', async () => {
    renderDialog();
    await screen.findByText('coinflip');
    const toggles = screen.getAllByTestId('add-to-favorites-toggle');
    expect(toggles).toHaveLength(1);
    toggles[0]!.click();
    expect(addToFavorites).toHaveBeenCalledWith('coinflip.dot');
    // Still present after adding — the list is snapshotted at open.
    expect(screen.getByText('coinflip')).toBeInTheDocument();
  });

  it('shows the action the toggle performs, not the current membership state', async () => {
    // Nothing favorite at open, so both products are listed and stay listed.
    layout$.next(snapshotWith([]));
    renderDialog();
    await screen.findByText('coinflip');

    const glyphOf = (index: number) =>
      screen.getAllByTestId('add-to-favorites-toggle')[index]!.querySelector('svg')?.getAttribute('class') ?? '';

    // Not a favorite -> the button adds -> plain star.
    await waitFor(() => expect(glyphOf(0)).toContain('star'));
    expect(glyphOf(0)).not.toContain('star-off');

    // Becomes a favorite while the dialog is open -> the button now removes -> crossed star.
    await act(async () => layout$.next(snapshotWith(['coinflip.dot'])));

    await waitFor(() => expect(glyphOf(0)).toContain('star-off'));
  });

  it('shows the loading spinner while the catalog is pending', async () => {
    publishedAppListingsResource.instead(() => new Promise<AppListing[]>(() => {}));
    renderDialog();
    expect(await screen.findByTestId('add-to-favorites-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('add-to-favorites-toggle')).not.toBeInTheDocument();
  });

  it('shows an error state with a Retry that refreshes the catalog', async () => {
    // Waiting on the recovered grid rather than on the call count: the count rises
    // the moment `refresh()` fires, while the state it produces lands a tick later —
    // outside the test, and outside `act`.
    const catalogRead = vi
      .fn<() => Promise<AppListing[]>>()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValue([listing('coinflip.dot')]);
    publishedAppListingsResource.instead(catalogRead);
    renderDialog();

    expect(await screen.findByTestId('add-to-favorites-error')).toBeInTheDocument();
    // Retry refreshes the TLD read as well, so the click is what triggers both settles.
    await act(async () => screen.getByTestId('add-to-favorites-retry').click());

    expect(await screen.findByText('coinflip')).toBeInTheDocument();
    expect(screen.queryByTestId('add-to-favorites-error')).not.toBeInTheDocument();
  });

  it('shows the "nothing to add" state when nothing is left to add', async () => {
    publishedAppListingsResource.instead(() => []);
    renderDialog();
    expect(await screen.findByTestId('add-to-favorites-nothing-to-add')).toBeInTheDocument();
  });

  it('shows the "no results" state when the search matches nothing', async () => {
    renderDialog();
    await screen.findByText('coinflip');
    const input = screen.getByTestId('add-to-favorites-search-input');
    fireEvent.change(input, { target: { value: 'zzz' } });
    expect(screen.getByTestId('add-to-favorites-no-results')).toBeInTheDocument();
    expect(screen.queryByTestId('add-to-favorites-nothing-to-add')).not.toBeInTheDocument();
  });
});
