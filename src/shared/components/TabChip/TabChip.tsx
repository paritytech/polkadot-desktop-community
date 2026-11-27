import { type ReactNode } from 'react';

import { cnTw } from '@/shared/utils';

type Props = {
  // Leading icon. An icon element that renders nothing (missing or broken image) leaves its slot empty, and the
  // slot collapses: the tab then shows the label alone, even in the collapsed state where an icon would replace it.
  icon?: ReactNode;
  label: string;
  isActive: boolean;
};

// Tab-strip item visuals shared by every tabContentSlot renderer: an optional leading icon and a truncating label.
export const TabChip = ({ icon, label, isActive }: Props) => (
  <>
    <span className="peer flex shrink-0 empty:hidden [&>*]:size-4 [&>*]:shrink-0 [&>*]:rounded-sm">{icon}</span>
    <span className={cnTw('min-w-0 truncate', !isActive && 'hidden peer-empty:inline @min-[80px]:inline')}>{label}</span>
  </>
);
