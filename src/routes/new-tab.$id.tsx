import { createFileRoute } from '@tanstack/react-router';

import { NewTab } from '@/features/browser';

export const Route = createFileRoute('/new-tab/$id')({
  component: NewTab,
});
