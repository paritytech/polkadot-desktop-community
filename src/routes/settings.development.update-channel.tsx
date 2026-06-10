import { createFileRoute } from '@tanstack/react-router';

import { AutoUpdateSettings } from '@/features/update-check';

export const Route = createFileRoute('/settings/development/update-channel')({
  component: AutoUpdateSettings,
});
