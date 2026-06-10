type ChatItemSkeletonProps = {
  isLast?: boolean;
};

export const ChatItemSkeleton = ({ isLast }: ChatItemSkeletonProps) => {
  return (
    <div className="relative flex h-22 w-full items-start gap-3 p-3">
      <div className="size-16 shrink-0 animate-pulse rounded-full bg-bg-action-secondary" />
      <div className="flex min-w-0 flex-1 flex-col gap-2 pt-1">
        <div className="flex w-full items-center gap-2">
          <div className="h-4 w-24 animate-pulse rounded bg-bg-action-secondary" />
          <div className="ml-auto h-3 w-12 animate-pulse rounded bg-bg-action-secondary" />
        </div>
        <div className="flex w-full flex-col gap-1.5">
          <div className="h-3 w-32 animate-pulse rounded bg-bg-action-secondary" />
          <div className="h-3 w-48 animate-pulse rounded bg-bg-action-secondary" />
        </div>
      </div>
      {!isLast && <div className="absolute right-3 bottom-0 left-22 h-px bg-border-divider" />}
    </div>
  );
};
