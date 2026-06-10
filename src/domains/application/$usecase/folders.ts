import {
  DEFAULT_RESIZE_HANDLES,
  FAVORITES_FOLDER_ID,
  FOLDER_DEFAULT_HEIGHT,
  FOLDER_MIN_HEIGHT,
  MAX_WIDGET_HEIGHT,
} from '../dashboard-layout/constants';
import { dashboardLayoutDb } from '../dashboard-layout/repository';
import { dashboardLayoutService } from '../dashboard-layout/service';
import { type DashboardCard, type FolderItemPositions } from '../dashboard-layout/types';

async function addIconToFavorites(iconId: string): Promise<{ ok: boolean; pageIndex?: number }> {
  const main = await dashboardLayoutDb.getMain();
  if (main.isErr()) return { ok: false };
  const sourcePages = dashboardLayoutService.ensurePages(main.value?.pages ?? null);

  const existing = dashboardLayoutService.findFavoritesFolder(sourcePages);
  const existingFolder = existing ? dashboardLayoutService.asFolder(existing.item) : null;
  if (existingFolder?.items.includes(iconId)) return { ok: false };

  const stripped = dashboardLayoutService.stripLegacyTopLevelCardFromPages(sourcePages, iconId);

  let nextPages: DashboardCard[][];
  let pageIndex: number;
  if (existing && existingFolder) {
    const nextFolder: DashboardCard = {
      ...existing.item,
      payload: { ...existingFolder, items: [...existingFolder.items, iconId] },
    };
    nextPages = stripped.map((page, pi) =>
      pi === existing.pageIndex ? page.map(entry => (entry.i === FAVORITES_FOLDER_ID ? nextFolder : entry)) : page,
    );
    pageIndex = existing.pageIndex;
  } else {
    const newFolder: DashboardCard = {
      i: FAVORITES_FOLDER_ID,
      x: 0,
      y: 0,
      w: 1,
      h: FOLDER_DEFAULT_HEIGHT,
      minW: 1,
      maxW: 1,
      minH: FOLDER_MIN_HEIGHT,
      maxH: MAX_WIDGET_HEIGHT,
      resizeHandles: [...DEFAULT_RESIZE_HANDLES],
      payload: { kind: 'folder', items: [iconId] },
    };
    const preferred = main.value?.activePageIndex ?? 0;
    ({ pages: nextPages, pageIndex } = dashboardLayoutService.placeOnPages(stripped, newFolder, preferred));
  }

  const saveResult = await dashboardLayoutDb.saveMainPages(nextPages, pageIndex);
  return { ok: saveResult.isOk(), pageIndex: saveResult.isOk() ? pageIndex : undefined };
}

async function isIconInFavorites(iconId: string): Promise<boolean> {
  const main = await dashboardLayoutDb.getMain();
  if (main.isErr()) return false;
  const pages = dashboardLayoutService.ensurePages(main.value?.pages ?? null);
  return dashboardLayoutService.favoriteProductIds(pages).has(iconId);
}

async function removeIconFromFolder(iconId: string): Promise<boolean> {
  const result = await dashboardLayoutDb.getMainPages();
  if (result.isErr() || !result.value) return false;

  let changed = false;
  const nextPages = result.value.map(page =>
    page.map(item => {
      const folder = dashboardLayoutService.asFolder(item);
      if (!folder || !folder.items.includes(iconId)) return item;
      changed = true;
      const positions = { ...folder.positions };
      delete positions[iconId];
      return {
        ...item,
        payload: {
          ...folder,
          items: folder.items.filter(id => id !== iconId),
          positions,
        },
      };
    }),
  );

  if (!changed) return false;
  const saveResult = await dashboardLayoutDb.saveMainPages(nextPages);
  return saveResult.isOk();
}

async function setFolderItemPositions(folderId: string, positions: FolderItemPositions): Promise<boolean> {
  const result = await dashboardLayoutDb.getMainPages();
  if (result.isErr() || !result.value) return false;

  let changed = false;
  const nextPages = result.value.map(page =>
    page.map(item => {
      const folder = dashboardLayoutService.asFolder(item);
      if (!folder || item.i !== folderId) return item;

      const nextPositions: FolderItemPositions = {};
      for (const id of folder.items) {
        const position = positions[id];
        if (position) {
          nextPositions[id] = position;
        }
      }

      const currentPositions = folder.positions ?? {};
      const hasChanged =
        Object.keys(nextPositions).length !== Object.keys(currentPositions).length ||
        Object.entries(nextPositions).some(([id, position]) => {
          const current = currentPositions[id];
          return !current || current.x !== position.x || current.y !== position.y;
        });

      if (!hasChanged) return item;

      changed = true;
      return { ...item, payload: { ...folder, positions: nextPositions } };
    }),
  );

  if (!changed) return false;
  const saveResult = await dashboardLayoutDb.saveMainPages(nextPages);
  return saveResult.isOk();
}

export const foldersUseCase = {
  addIconToFavorites,
  isIconInFavorites,
  removeIconFromFolder,
  setFolderItemPositions,
};
