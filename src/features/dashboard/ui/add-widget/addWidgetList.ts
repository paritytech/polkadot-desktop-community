import { type DashboardCard, type DashboardCardPayload } from '@/domains/application';
import { type AppListing, browseService } from '@/domains/product';
import { type AddableDashboardCard } from '../../di';

import { type AddWidgetSidebarEntry } from './types';

type TranslateFn = (key: string) => string;

// Comparable/searchable display name: native entries carry an i18n key resolved
// here, published entries already hold a concrete (external) manifest string.
function sidebarEntryName(entry: AddWidgetSidebarEntry, t: TranslateFn): string {
  return entry.source === 'native' ? t(entry.card.displayNameKey) : entry.listing.manifest.displayName;
}

export function buildNativeSidebarEntries(addableCards: AddableDashboardCard[]): AddWidgetSidebarEntry[] {
  return addableCards.map(entry => ({
    source: 'native' as const,
    id: entry.gridId,
    card: entry,
  }));
}

export function buildPublishedSidebarEntries(listings: AppListing[]): AddWidgetSidebarEntry[] {
  return listings.map(listing => {
    const baseName = browseService.listingBaseName(listing);
    return {
      source: 'published' as const,
      id: baseName,
      listing,
      baseName,
    };
  });
}

export function mergeAddWidgetSidebarEntries(
  nativeEntries: AddWidgetSidebarEntry[],
  publishedEntries: AddWidgetSidebarEntry[],
  t: TranslateFn,
): AddWidgetSidebarEntry[] {
  const sortByName = (a: AddWidgetSidebarEntry, b: AddWidgetSidebarEntry) =>
    sidebarEntryName(a, t).localeCompare(sidebarEntryName(b, t), undefined, { sensitivity: 'base' });

  return [...[...nativeEntries].sort(sortByName), ...[...publishedEntries].sort(sortByName)];
}

export function filterSidebarEntries(entries: AddWidgetSidebarEntry[], query: string, t: TranslateFn): AddWidgetSidebarEntry[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return entries;

  return entries.filter(entry => {
    if (entry.source === 'native') {
      const haystack = `${sidebarEntryName(entry, t)} ${entry.id}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    }

    const haystack = `${entry.listing.manifest.displayName} ${entry.baseName} ${entry.listing.label}`.toLowerCase();
    return haystack.includes(normalizedQuery);
  });
}

export function findNativeDashboardPlacement(
  pages: DashboardCard[][],
  entry: AddableDashboardCard,
): { w: number; h: number; pageIndex: number } | null {
  // Match on the canonical grid id (`card.i`) — the same identity the
  // duplicate-card guard in `addCardToLayout` uses. Matching on `payload.kind`
  // is wrong for entries whose `kind` differs from the stored payload kind
  // (e.g. Favorites: entry kind `folder:favorites` vs payload kind `folder`).
  for (const [pageIndex, page] of pages.entries()) {
    const item = page.find(card => card.i === entry.gridId);
    if (item) return { w: item.w, h: item.h, pageIndex };
  }
  return null;
}

export function buildNativeDashboardCard(entry: AddableDashboardCard, size: { w: number; h: number }): DashboardCard {
  const { payload, gridSize } = entry.createCard();
  const rules = entry.defaultLayoutRules;

  return {
    i: entry.gridId,
    x: 0,
    y: 0,
    w: size.w,
    h: size.h,
    minW: rules?.minW ?? gridSize.w,
    maxW: rules?.maxW ?? 1,
    minH: rules?.minH ?? gridSize.h,
    maxH: rules?.maxH ?? 8,
    payload: payload satisfies DashboardCardPayload,
  };
}
