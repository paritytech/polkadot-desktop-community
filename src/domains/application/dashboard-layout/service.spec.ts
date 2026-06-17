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
    const pages: DashboardCard[][] = [[favoritesFolder(['my-app']), legacyIcon('my-app'), widget('other')]];

    const next = dashboardLayoutService.stripLegacyTopLevelCardFromPages(pages, 'my-app');

    expect(next[0]).toHaveLength(2);
    const favoritesCard = next[0]?.[0];
    expect(favoritesCard).toBeDefined();
    expect(dashboardLayoutService.asFolder(favoritesCard!)?.items).toEqual(['my-app']);
    expect(next[0]!.some(item => item.i === 'my-app' && dashboardLayoutService.isProductWidgetCard(item))).toBe(false);
    expect(next[0]!.some(item => item.i === 'other')).toBe(true);
  });

  it('stripCardFromPages still removes both widget and favorites (full reset)', () => {
    const pages: DashboardCard[][] = [[favoritesFolder(['my-app']), widget('my-app')]];

    const next = dashboardLayoutService.stripCardFromPages(pages, 'my-app');

    const folder = next[0]?.find(item => item.i === FAVORITES_FOLDER_ID);
    expect(folder).toBeDefined();
    expect(dashboardLayoutService.asFolder(folder!)?.items).toEqual([]);
    expect(next[0]!.some(item => item.i === 'my-app')).toBe(false);
  });

  it('hasProductWidgetOnPages detects only product widgets', () => {
    const pages: DashboardCard[][] = [[favoritesFolder(['my-app']), legacyIcon('my-app')]];

    expect(dashboardLayoutService.hasProductWidgetOnPages(pages, 'my-app')).toBe(false);

    const withWidget: DashboardCard[][] = [[favoritesFolder(['my-app']), widget('my-app')]];
    expect(dashboardLayoutService.hasProductWidgetOnPages(withWidget, 'my-app')).toBe(true);
  });
});

describe('dashboardLayoutService.findProductDashboardPlacement', () => {
  it('returns the top-level widget placement when present', () => {
    const pages: DashboardCard[][] = [[], [widget('my-app')]];

    expect(dashboardLayoutService.findProductDashboardPlacement(pages, 'my-app')).toEqual({ w: 1, h: 4, pageIndex: 1 });
  });

  it('detects a product living inside a user (non-favorites) folder', () => {
    const pages: DashboardCard[][] = [[userFolder('folder-1', ['my-app'])]];

    expect(dashboardLayoutService.findProductDashboardPlacement(pages, 'my-app')).toEqual({ w: 1, h: 4, pageIndex: 0 });
  });

  it('ignores favorites-folder membership so a favorite can still be added as a widget', () => {
    const pages: DashboardCard[][] = [[favoritesFolder(['my-app'])]];

    expect(dashboardLayoutService.findProductDashboardPlacement(pages, 'my-app')).toBeNull();
  });

  it('returns null when the product is neither a widget nor inside a folder', () => {
    const pages: DashboardCard[][] = [[widget('other')]];

    expect(dashboardLayoutService.findProductDashboardPlacement(pages, 'my-app')).toBeNull();
  });
});

describe('sizeHintsToVariants', () => {
  it('maps heights to vertical variants, ignoring width', () => {
    expect(dashboardLayoutService.sizeHintsToVariants({ height: [1, 2, 4] })).toEqual(['small', 'medium', 'large']);
    expect(dashboardLayoutService.sizeHintsToVariants({ height: [1, 2, 4], width: 2 })).toEqual(['small', 'medium', 'large']);
  });

  it('returns only declared sizes', () => {
    expect(dashboardLayoutService.sizeHintsToVariants({ height: [2] })).toEqual(['medium']);
  });

  it('offers all four sizes only with height [0,1,2,4] and width 2', () => {
    expect(dashboardLayoutService.sizeHintsToVariants({ height: [0, 1, 2, 4], width: 2 })).toEqual([
      'small',
      'medium',
      'large',
      'horizontal',
    ]);
  });

  it('treats height 0 + width 2 as horizontal-only', () => {
    expect(dashboardLayoutService.sizeHintsToVariants({ height: [0], width: 2 })).toEqual(['horizontal']);
  });

  it('does not add horizontal without both a 0 height and width 2', () => {
    // 0 present but width missing/not 2
    expect(dashboardLayoutService.sizeHintsToVariants({ height: [0, 1] })).toEqual(['small']);
    expect(dashboardLayoutService.sizeHintsToVariants({ height: [0, 1], width: 1 })).toEqual(['small']);
    // width 2 but no 0 in height
    expect(dashboardLayoutService.sizeHintsToVariants({ height: [1, 2], width: 2 })).toEqual(['small', 'medium']);
  });

  it('returns empty for invalid (pixel) hints', () => {
    expect(dashboardLayoutService.sizeHintsToVariants({ height: [400], width: 360 })).toEqual([]);
  });

  it('returns empty when no height maps and horizontal does not apply', () => {
    expect(dashboardLayoutService.sizeHintsToVariants({ height: [0] })).toEqual([]);
    expect(dashboardLayoutService.sizeHintsToVariants({ height: [3] })).toEqual([]);
  });
});

describe('sizeHintsToLayoutRules', () => {
  it('derives resize bounds from all four sizes', () => {
    expect(dashboardLayoutService.sizeHintsToLayoutRules({ height: [0, 1, 2, 4], width: 2 })).toEqual({
      minH: 2,
      maxH: 8,
      minW: 1,
      maxW: 2,
      menuSizes: ['small', 'medium', 'large', 'horizontal'],
    });
  });

  it('keeps width 1 when horizontal is not offered', () => {
    expect(dashboardLayoutService.sizeHintsToLayoutRules({ height: [1, 2, 4] })).toEqual({
      minH: 2,
      maxH: 8,
      minW: 1,
      maxW: 1,
      menuSizes: ['small', 'medium', 'large'],
    });
  });

  it('locks a horizontal-only widget to a 2x4 footprint', () => {
    expect(dashboardLayoutService.sizeHintsToLayoutRules({ height: [0], width: 2 })).toEqual({
      minH: 4,
      maxH: 4,
      minW: 2,
      maxW: 2,
      menuSizes: ['horizontal'],
    });
  });

  it('returns null for invalid hints', () => {
    expect(dashboardLayoutService.sizeHintsToLayoutRules({ height: [400], width: 360 })).toBeNull();
    expect(dashboardLayoutService.sizeHintsToLayoutRules({ height: [3] })).toBeNull();
  });
});

describe('getVariantFromGridSize', () => {
  it('maps grid sizes to variants', () => {
    expect(dashboardLayoutService.getVariantFromGridSize(1, 2)).toBe('small');
    expect(dashboardLayoutService.getVariantFromGridSize(1, 4)).toBe('medium');
    expect(dashboardLayoutService.getVariantFromGridSize(1, 8)).toBe('large');
    expect(dashboardLayoutService.getVariantFromGridSize(2, 4)).toBe('horizontal');
  });

  it('falls back to small for unknown sizes', () => {
    expect(dashboardLayoutService.getVariantFromGridSize(3, 3)).toBe('small');
  });
});
