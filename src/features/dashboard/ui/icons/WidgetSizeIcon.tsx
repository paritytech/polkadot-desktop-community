import { type WidgetSizeIconVariant } from '@/domains/application';

type WidgetSizeIconProps = {
  variant: WidgetSizeIconVariant;
  className?: string;
};

const OUTER = { x: 1.333, y: 2.667, width: 13.334, height: 10.667, rx: 1 } as const;

const INNER_RECTS: Record<WidgetSizeIconVariant, { x: number; y: number; width: number; height: number }> = {
  small: { x: 3.333, y: 4.667, width: 2, height: 2 },
  medium: { x: 3.333, y: 4.667, width: 5.334, height: 3.666 },
  large: { x: 3.333, y: 4.667, width: 5.334, height: 6.666 },
  horizontal: { x: 4.667, y: 6.333, width: 6.666, height: 3.334 },
};

export const WidgetSizeIcon = ({ variant, className }: WidgetSizeIconProps) => {
  const inner = INNER_RECTS[variant];

  return (
    <svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden focusable="false">
      <rect
        x={OUTER.x}
        y={OUTER.y}
        width={OUTER.width}
        height={OUTER.height}
        rx={OUTER.rx}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.3}
      />
      <rect x={inner.x} y={inner.y} width={inner.width} height={inner.height} rx={0.3} fill="currentColor" />
    </svg>
  );
};
