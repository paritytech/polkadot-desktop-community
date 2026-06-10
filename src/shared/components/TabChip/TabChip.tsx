import { type ReactNode } from 'react';

import { cnTw } from '@/shared/utils';

// Shared icon styling for every tabContentSlot renderer. Exported so cross-feature
// renderers (browser/chat/dashboard/settings) class their icon the same way before
// handing it to <TabChip /> — icons are arbitrary nodes (SVG, lucide, ProductIcon),
// so the caller owns the className rather than TabChip cloning it on.
export const tabIconClassName = 'size-4 shrink-0 text-fg-primary';

type Props = {
  icon: ReactNode;
  label: string;
  isActive: boolean;
};

// Tab-strip item visuals shared by every tabContentSlot renderer: a leading icon
// followed by a truncating label.
export const TabChip = ({ icon, label, isActive }: Props) => (
  <>
    <span className="shrink-0">{icon}</span>
    <span className={cnTw('min-w-0 truncate text-sm', !isActive && 'hidden @min-[80px]:inline')}>{label}</span>
  </>
);
