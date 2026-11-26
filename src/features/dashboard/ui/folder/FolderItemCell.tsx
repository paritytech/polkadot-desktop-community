import { type ReactNode } from 'react';

import { AppIcon } from '@/shared/components';
import { cnTw } from '@/shared/utils';
import { type FolderItemIconSize } from '../../types';

type Props = {
  // Resolved icon image URL (e.g. a product's loaded icon).
  iconUrl?: string;
  // Pre-rendered icon node (e.g. a native addable entry's own `icon`), used as-is.
  iconNode?: ReactNode;
  name: string;
  iconSize: FolderItemIconSize;
};

// Presentational icon+label cell shared by the favourites-folder content
// providers. Mirrors the visual the folder rendered before the content seam, so
// resolvable items look identical regardless of which provider supplies them.
// The card fills its grid row rather than declaring a height: the macro draws it
// at 92px in the medium widget and 123px in the large one, so the icon area
// absorbs the difference and only the label row is fixed.
export const FolderItemCell = ({ iconUrl, iconNode, name, iconSize }: Props) => {
  return (
    <span className="flex h-full w-full flex-col overflow-hidden rounded-xl border border-stroke-primary bg-bg-surface-container">
      <span className="flex min-h-0 flex-1 items-center justify-center bg-bg-surface-nested">
        <AppIcon size={iconSize} src={iconUrl} alt={name}>
          {iconNode ? (
            <span
              className={cnTw(
                'flex items-center justify-center overflow-hidden rounded-sm',
                iconSize === '64' ? 'size-10' : 'size-7',
              )}
            >
              {iconNode}
            </span>
          ) : null}
        </AppIcon>
      </span>
      <span className="flex w-full shrink-0 items-center justify-center overflow-hidden p-2">
        <span className="max-w-full truncate text-xs font-semibold text-fg-primary">{name}</span>
      </span>
    </span>
  );
};
