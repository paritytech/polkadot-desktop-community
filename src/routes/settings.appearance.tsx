import { createFileRoute } from '@tanstack/react-router';

import { ThemeSettings } from '@/features/theme-toggle';

export const Route = createFileRoute('/settings/appearance')({
  component: ThemeSettings,
});
