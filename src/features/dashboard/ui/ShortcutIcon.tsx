import { type ReactNode } from 'react';

import { getProductIcon } from '../productIcons';

type ShortcutIconProps = {
  widgetId: string;
  onClick: () => void;
  customIcon?: ReactNode;
  label?: string;
};

export const ShortcutIcon = ({ widgetId, onClick, customIcon, label }: ShortcutIconProps) => {
  // Use custom icon if provided
  if (customIcon) {
    return (
      <div
        className="relative flex h-full w-full cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl"
        onClick={onClick}
      >
        {customIcon}
        {label && <span className="truncate text-xs text-text-secondary">{label}</span>}
      </div>
    );
  }

  // Get icon from native products
  const Icon = getProductIcon(widgetId);
  if (!Icon) return null;

  return (
    <div
      className="relative flex h-full w-full cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl"
      onClick={onClick}
    >
      <Icon className="h-8 w-8 text-[var(--icon-accent)]" />
      {label && <span className="truncate text-xs text-text-secondary">{label}</span>}
    </div>
  );
};
