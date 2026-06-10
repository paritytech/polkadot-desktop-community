import { createFileRoute } from '@tanstack/react-router';
import { useCallback } from 'react';

import { Dashboard } from '@/features/dashboard';

type DashboardSearch = {
  page?: number;
};

const parseDashboardSearch = (search: Record<string, unknown>): DashboardSearch => {
  const rawPage = search['page'];
  if (rawPage === undefined || rawPage === null || rawPage === '') {
    return {};
  }

  const parsed = typeof rawPage === 'number' ? rawPage : Number(rawPage);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return {};
  }

  return { page: parsed };
};

const DashboardRoute = () => {
  const { page } = Route.useSearch();
  const navigate = Route.useNavigate();

  const handleInitialPageIndexApplied = useCallback(() => {
    navigate({ search: {}, replace: true });
  }, [navigate]);

  return <Dashboard initialPageIndex={page} onInitialPageIndexApplied={handleInitialPageIndexApplied} />;
};

export const Route = createFileRoute('/dashboard')({
  validateSearch: parseDashboardSearch,
  component: DashboardRoute,
});
