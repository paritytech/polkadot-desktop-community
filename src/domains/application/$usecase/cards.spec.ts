import { ResultAsync } from 'neverthrow';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../dashboard-layout/repository', () => ({
  dashboardLayoutDb: {
    getMain: vi.fn(),
    saveMainPages: vi.fn(),
  },
}));

import { DEFAULT_DASHBOARD_PAGES } from '../dashboard-layout/constants';
import { type MainDashboardLayoutSnapshot, dashboardLayoutDb } from '../dashboard-layout/repository';

import { cardsUseCase } from './cards';

const okMain = (pages: MainDashboardLayoutSnapshot['pages'] | null) =>
  ResultAsync.fromSafePromise<MainDashboardLayoutSnapshot | null, Error>(
    Promise.resolve(pages === null ? null : { pages, activePageIndex: 0 }),
  );
const errMain = () => ResultAsync.fromPromise(Promise.reject(new Error('db')), e => (e instanceof Error ? e : new Error()));

beforeEach(() => {
  vi.clearAllMocks();
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  vi.mocked(dashboardLayoutDb.saveMainPages).mockReturnValue(ResultAsync.fromSafePromise(Promise.resolve({} as never)));
});

describe('seedDefaultMainLayout', () => {
  it('seeds the default pages when no dashboard exists yet', async () => {
    vi.mocked(dashboardLayoutDb.getMain).mockReturnValue(okMain(null));

    const seeded = await cardsUseCase.seedDefaultMainLayout();

    expect(seeded).toBe(true);
    expect(dashboardLayoutDb.saveMainPages).toHaveBeenCalledWith(DEFAULT_DASHBOARD_PAGES, 0);
  });

  it('is a no-op when a dashboard already has pages', async () => {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    vi.mocked(dashboardLayoutDb.getMain).mockReturnValue(okMain([[{ i: 'x' } as never]]));

    const seeded = await cardsUseCase.seedDefaultMainLayout();

    expect(seeded).toBe(false);
    expect(dashboardLayoutDb.saveMainPages).not.toHaveBeenCalled();
  });

  it('does not seed when the layout read fails', async () => {
    vi.mocked(dashboardLayoutDb.getMain).mockReturnValue(errMain());

    const seeded = await cardsUseCase.seedDefaultMainLayout();

    expect(seeded).toBe(false);
    expect(dashboardLayoutDb.saveMainPages).not.toHaveBeenCalled();
  });
});
