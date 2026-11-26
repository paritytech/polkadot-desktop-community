import { ListItem } from '@/shared/components';

export const ChatItemSkeleton = () => (
  <ListItem
    icon={<span className="size-10 animate-pulse rounded-full bg-bg-action-secondary" />}
    label={<span className="block h-5 w-24 animate-pulse rounded bg-bg-action-secondary" />}
    description={<span className="h-4 w-32 animate-pulse rounded bg-bg-action-secondary" />}
  />
);
