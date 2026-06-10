import { type ReactNode } from 'react';

import { cnTw } from '@/shared/utils';

type CommonProps = {
  label: ReactNode;
  description?: ReactNode;
  active?: boolean;
  onClick?: VoidFunction;
};

type IconVariantProps = CommonProps & {
  variant?: 'icon';
  icon: ReactNode;
  right?: ReactNode;
};

type RadioVariantProps = CommonProps & {
  variant: 'radio';
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
};

type Props = IconVariantProps | RadioVariantProps;

export const ListItem = (props: Props) => {
  const { label, description, active, onClick } = props;

  const containerClass = cnTw(
    'flex w-full rounded-xl transition-colors',
    active ? 'bg-bg-selection-container-hover' : 'bg-bg-surface-container',
    onClick && !active && 'cursor-pointer select-none hover:bg-bg-selection-container-hover',
  );

  if (props.variant === 'radio') {
    return (
      <div className={cnTw(containerClass, 'items-center gap-3 px-3 py-1')} onClick={onClick}>
        <input
          type="radio"
          checked={props.checked}
          className="size-4 shrink-0 cursor-pointer accent-fg-primary"
          onChange={e => props.onCheckedChange?.(e.target.checked)}
        />
        <div className="flex flex-col">
          <span className="text-sm text-fg-primary">{label}</span>
          {description && <span className="text-xs text-fg-tertiary">{description}</span>}
        </div>
      </div>
    );
  }

  return (
    <div className={cnTw(containerClass, 'items-center gap-4 p-3')} onClick={onClick}>
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-bg-illustration-light">{props.icon}</div>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm text-fg-primary">{label}</span>
          {description && <span className="truncate text-xs text-fg-tertiary">{description}</span>}
        </div>
      </div>
      {props.right !== undefined && <div className="shrink-0">{props.right}</div>}
    </div>
  );
};
