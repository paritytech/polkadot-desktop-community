import { createFileRoute } from '@tanstack/react-router';

import { TestnetSettings } from '@/features/statement-store-network';

export const Route = createFileRoute('/settings/development/network')({
  component: TestnetSettings,
});
