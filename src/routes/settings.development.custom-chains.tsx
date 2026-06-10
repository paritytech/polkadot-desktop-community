import { createFileRoute } from '@tanstack/react-router';

import { CustomChainsSettings } from '@/features/custom-chains';

export const Route = createFileRoute('/settings/development/custom-chains')({
  component: CustomChainsSettings,
});
