import { type ReactNode } from 'react';

import { AppIcon } from '@/shared/components';
import { TEST_IDS } from '@/shared/test-ids';

type Props = {
  title: string;
  iconUrl?: string;
  onOpen?: VoidFunction;
  action?: ReactNode;
};

// The Favorites card from the macro (node 1533-13978): a nested-surface top area
// with a 64px app-icon and an action revealed on hover (top-right), then a title
// bar below. Presentational — all state arrives via props.
export const FavoriteCard = ({ title, iconUrl, onOpen, action }: Props) => {
  return (
    <div
      data-testid={TEST_IDS.favoritesCard}
      className="group/favorite-card relative flex flex-col overflow-hidden rounded-xl border border-stroke-primary bg-bg-surface-container"
    >
      <button
        type="button"
        aria-label={title}
        className="flex flex-1 cursor-pointer items-center justify-center bg-bg-surface-nested py-6 focus-visible:outline-none"
        onClick={onOpen}
      >
        <AppIcon size="64" src={iconUrl} alt={title} />
      </button>

      {action ? (
        <span className="absolute end-1 top-1 opacity-0 transition-opacity group-hover/favorite-card:opacity-100 focus-within:opacity-100">
          {action}
        </span>
      ) : null}

      <div className="flex w-full items-center justify-center overflow-hidden p-2">
        <span className="max-w-full truncate text-xs leading-4 font-semibold text-fg-primary">{title}</span>
      </div>
    </div>
  );
};
