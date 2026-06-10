import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/product/$id/{-$route}')({
  component: () => null,
});
