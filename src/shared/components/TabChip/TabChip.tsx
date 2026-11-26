import { type ReactNode } from 'react';

import { cnTw } from '@/shared/utils';

type Props = {
  // Always-shown leading icon (real product / section icon).
  icon?: ReactNode;
  // Fallback shown ONLY in the collapsed icon-only state (many tabs, < 80px),
  // where the label is hidden and the tab would otherwise be empty. In the normal
  // state an iconless tab renders the label alone, centered by the tab container.
  placeholder?: ReactNode;
  label: string;
  isActive: boolean;
};

// Tab-strip item visuals shared by every tabContentSlot renderer: an optional
// leading icon, an optional collapsed-state placeholder, and a truncating label.
export const TabChip = ({ icon, placeholder, label, isActive }: Props) => (
  <>
    {icon ? <span className="flex shrink-0 [&>*]:size-4 [&>*]:shrink-0 [&>*]:rounded-sm">{icon}</span> : null}
    {placeholder ? (
      <span
        className={cnTw('flex shrink-0 [&>*]:size-4 [&>*]:shrink-0 [&>*]:rounded-sm', isActive ? 'hidden' : '@min-[80px]:hidden')}
      >
        {placeholder}
      </span>
    ) : null}
    <span className={cnTw('min-w-0 truncate', !isActive && 'hidden @min-[80px]:inline')}>{label}</span>
  </>
);
