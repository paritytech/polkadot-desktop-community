import { useMemo } from 'react';

type ChatItemSkeletonProps = {
  itemHeight?: number;
};

export const ChatItemSkeleton = ({ itemHeight }: ChatItemSkeletonProps) => {
  const rowStyle = useMemo(() => ({ height: itemHeight }), [itemHeight]);

  const row = (
    <div className="flex min-h-14 w-full items-center gap-3 rounded-xl px-3 py-2">
      <div className="size-10 shrink-0 animate-pulse rounded-full bg-bg-action-secondary" />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="h-5 w-24 animate-pulse rounded bg-bg-action-secondary" />
        <div className="h-4 w-32 animate-pulse rounded bg-bg-action-secondary" />
      </div>
    </div>
  );

  if (itemHeight == null) return row;

  return (
    <div className="flex overflow-hidden" style={rowStyle}>
      {row}
    </div>
  );
};
