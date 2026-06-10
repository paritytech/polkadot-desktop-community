import { describe, expect, it } from 'vitest';

import { FAVORITES_FOLDER_ID } from './constants';
import { dashboardLayoutService } from './service';
import { type DashboardCard } from './types';

const widget = (productId: string): DashboardCard => ({
  i: productId,
  x: 0,
  y: 0,
  w: 1,
  h: 4,
  payload: { kind: 'product:widget', productId },
});

const favoritesFolder = (items: string[]): DashboardCard => ({
  i: FAVORITES_FOLDER_ID,
  x: 0,
  y: 0,
  w: 1,
  h: 4,
  payload: { kind: 'folder', items },
});

const legacyIcon = (productId: string): DashboardCard => ({
  i: productId,
  x: 1,
  y: 0,
  w: 1,
  h: 1,
  payload: { kind: 'product:icon', productId },
});

const userFolder = (folderId: string, items: string[]): DashboardCard => ({
  i: folderId,
  x: 0,
  y: 0,
  w: 1,
  h: 4,
  payload: { kind: 'folder', items },
});

describe('dashboardLayoutService favorites vs widgets', () => {
  it('stripLegacyTopLevelCardFromPages removes legacy grid icon but keeps widget and favorites', () => {
    const pages: DashboardCard[][] = [[favoritesFolder(['coinflip']), legacyIcon('coinflip'), widget('other')]];

    const next = dashboardLayoutService.stripLegacyTopLevelCardFromPages(pages, 'coinflip');

    expect(next[0]).toHaveLength(2);
    const favoritesCard = next[0]?.[0];
    expect(favoritesCard).toBeDefined();
    expect(dashboardLayoutService.asFolder(favoritesCard!)?.items).toEqual(['coinflip']);
    expect(next[0]!.some(item => item.i === 'coinflip' && dashboardLayoutService.isProductWidgetCard(item))).toBe(false);
    expect(next[0]!.some(item => item.i === 'other')).toBe(true);
  });

  it('stripCardFromPages still removes both widget and favorites (full reset)', () => {
    const pages: DashboardCard[][] = [[favoritesFolder(['coinflip']), widget('coinflip')]];

    const next = dashboardLayoutService.stripCardFromPages(pages, 'coinflip');

    const folder = next[0]?.find(item => item.i === FAVORITES_FOLDER_ID);
    expect(folder).toBeDefined();
    expect(dashboardLayoutService.asFolder(folder!)?.items).toEqual([]);
    expect(next[0]!.some(item => item.i === 'coinflip')).toBe(false);
  });

  it('hasProductWidgetOnPages detects only product widgets', () => {
    const pages: DashboardCard[][] = [[favoritesFolder(['coinflip']), legacyIcon('coinflip')]];

    expect(dashboardLayoutService.hasProductWidgetOnPages(pages, 'coinflip')).toBe(false);

    const withWidget: DashboardCard[][] = [[favoritesFolder(['coinflip']), widget('coinflip')]];
    expect(dashboardLayoutService.hasProductWidgetOnPages(withWidget, 'coinflip')).toBe(true);
  });
});

describe('dashboardLayoutService.findProductDashboardPlacement', () => {
  it('returns the top-level widget placement when present', () => {
    const pages: DashboardCard[][] = [[], [widget('coinflip')]];

    expect(dashboardLayoutService.findProductDashboardPlacement(pages, 'coinflip')).toEqual({ w: 1, h: 4, pageIndex: 1 });
  });

  it('detects a product living inside a user (non-favorites) folder', () => {
    const pages: DashboardCard[][] = [[userFolder('folder-1', ['coinflip'])]];

    expect(dashboardLayoutService.findProductDashboardPlacement(pages, 'coinflip')).toEqual({ w: 1, h: 4, pageIndex: 0 });
  });

  it('ignores favorites-folder membership so a favorite can still be added as a widget', () => {
    const pages: DashboardCard[][] = [[favoritesFolder(['coinflip'])]];

    expect(dashboardLayoutService.findProductDashboardPlacement(pages, 'coinflip')).toBeNull();
  });

  it('returns null when the product is neither a widget nor inside a folder', () => {
    const pages: DashboardCard[][] = [[widget('other')]];

    expect(dashboardLayoutService.findProductDashboardPlacement(pages, 'coinflip')).toBeNull();
  });
});
