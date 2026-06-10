import { Button } from '@novasamatech/tr-ui';

import { useTranslation } from '@/shared/translation';
import { type WidgetSizeIconVariant } from '@/domains/application';
import { WIDGET_SIZE_CONFIG } from '../../constants';

import { type AddWidgetModalCardCopy } from './types';
import { type WidgetCardDefinition } from './widgetModalConstants';

export const ModalSizeChip = ({
  label,
  isSelected,
  disabled,
  onClick,
}: {
  label: string;
  isSelected: boolean;
  disabled?: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    disabled={disabled}
    aria-pressed={isSelected}
    aria-disabled={disabled ?? false}
    className={`flex h-full shrink-0 items-center rounded-md px-2 text-sm leading-5 font-medium whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-50 ${
      isSelected
        ? 'bg-bg-action-primary-inverted text-fg-primary shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_-1px_rgba(0,0,0,0.1)]'
        : 'bg-transparent text-fg-primary hover:bg-bg-action-secondary-hover'
    }`}
    onClick={onClick}
  >
    {label}
  </button>
);

export const WidgetCardPreview = ({ variant }: { variant: WidgetSizeIconVariant }) => {
  return (
    <div className="flex h-full w-full rounded-[4px] bg-bg-surface-nested p-2">
      <svg viewBox="0 0 232 142" className="h-full w-full" aria-hidden focusable="false">
        <rect x="0" y="0" width="232" height="142" rx="4" fill="hsl(var(--bg-surface-container))" />

        <circle cx="14.3" cy="14.3" r="2.05" fill="#FF736A" />
        <circle cx="21" cy="14.3" r="2.05" fill="#FEBC2E" />
        <circle cx="27.7" cy="14.3" r="2.05" fill="#19C332" />
        <rect x="84" y="11" width="80" height="6" rx="2" fill="rgba(0,0,0,0.08)" />

        <rect
          x={variant === 'horizontal' ? 68 : 12}
          y={variant === 'horizontal' ? 59 : 21}
          width={variant === 'horizontal' ? 112 : 56}
          height={variant === 'small' ? 28 : variant === 'medium' ? 56 : variant === 'large' ? 112 : 56}
          rx="4"
          fill="hsl(var(--fg-success) / 0.08)"
          stroke="hsl(var(--border-success))"
          strokeWidth="0.5"
          strokeDasharray="2 2"
        />
      </svg>
    </div>
  );
};

export const AddWidgetModalCard = ({
  card,
  copy,
  selectedVariant,
  isWidgetAlreadyOnDashboard,
  onSelectSize,
  onAdd,
  onOpen,
}: {
  card: WidgetCardDefinition;
  /** When set, replaces generic i18n title/description (e.g. product manifest from browse-sdk). */
  copy?: AddWidgetModalCardCopy;
  selectedVariant: WidgetSizeIconVariant;
  isWidgetAlreadyOnDashboard: boolean;
  onSelectSize: (variant: WidgetSizeIconVariant) => void;
  onAdd: VoidFunction;
  onOpen: VoidFunction;
}) => {
  const { t } = useTranslation();
  const title = copy?.title ?? t(card.titleKey);
  const description = copy?.description ?? t(card.descriptionKey);

  return (
    <article className="flex items-stretch overflow-hidden rounded-[8px] border border-border-primary bg-bg-surface-container">
      <div className="flex h-[158px] w-[248px] shrink-0 bg-bg-surface-nested">
        <WidgetCardPreview variant={selectedVariant} />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-[38px] p-4">
        <div className="flex flex-col gap-1 pt-1">
          <div className="text-base leading-6 font-semibold text-fg-primary">{title}</div>
          <div className="text-sm leading-[18px] font-normal text-fg-secondary">{description}</div>
        </div>

        <div className="flex w-full items-center justify-between gap-4 pb-0.5">
          <div className="flex h-9 shrink-0 flex-nowrap items-center gap-1 rounded-[10px] bg-bg-surface-nested p-1">
            {card.sizeVariants.map(variant => (
              <ModalSizeChip
                key={variant}
                label={t(WIDGET_SIZE_CONFIG[variant].labelKey)}
                disabled={isWidgetAlreadyOnDashboard}
                isSelected={selectedVariant === variant}
                onClick={() => onSelectSize(variant)}
              />
            ))}
          </div>

          <Button
            type="button"
            size="default"
            aria-label={isWidgetAlreadyOnDashboard ? t('feature.dashboard.addWidget.open') : t('feature.dashboard.addWidget.add')}
            onClick={isWidgetAlreadyOnDashboard ? onOpen : onAdd}
          >
            {isWidgetAlreadyOnDashboard ? t('feature.dashboard.addWidget.open') : t('feature.dashboard.addWidget.add')}
          </Button>
        </div>
      </div>
    </article>
  );
};
