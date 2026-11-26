import { Heart } from 'lucide-react';

type Props = {
  count?: number;
  reaction?: boolean;
};

export const UnreadCount = ({ count = 0, reaction }: Props) => {
  if (count <= 0 && !reaction) return null;

  return (
    <span className="flex items-center gap-1">
      {reaction ? (
        <span className="flex size-5 items-center justify-center rounded-full bg-bg-illustration-dark">
          <Heart aria-hidden className="size-3 fill-current text-fg-primary-inverted" />
        </span>
      ) : null}
      {count > 0 ? (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-bg-illustration-dark px-1 text-2xs font-semibold text-fg-primary-inverted">
          {count}
        </span>
      ) : null}
    </span>
  );
};
