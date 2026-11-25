import { Star } from 'lucide-react';

import { Button, SegmentedControl } from '@/shared/components';
import { useTranslation } from '@/shared/translation';
import { cnTw } from '@/shared/utils';
import { type WidgetSizeIconVariant } from '@/domains/application';
import { WIDGET_SIZE_CONFIG } from '../../constants';

import { type AddWidgetModalCardCopy } from './types';
import { type WidgetCardDefinition } from './widgetModalConstants';

// Shared "Add to Favorites" affordance used by both the product and native AtD
// panels. Labels/aria are asserted by e2e (`/^Add(ed)? to Favorites$/`) — keep them.
export const AddWidgetFavoritesButton = ({ isInFavorites, onAdd }: { isInFavorites: boolean; onAdd: VoidFunction }) => {
  const { t } = useTranslation();
  const label = isInFavorites
    ? t('feature.dashboard.addWidget.addedToFavoritesButton')
    : t('feature.dashboard.addWidget.addToFavorites');

  return (
    <Button type="button" size="sm" disabled={isInFavorites} aria-label={label} onClick={onAdd}>
      <span className="inline-flex items-center gap-1 text-xs leading-4 font-normal">
        <Star
          className={cnTw('size-4 shrink-0', isInFavorites ? 'fill-current text-fg-secondary' : 'text-fg-primary')}
          aria-hidden
          strokeWidth={1.75}
        />
        {label}
      </span>
    </Button>
  );
};

export const WidgetCardPreview = ({ variant }: { variant: WidgetSizeIconVariant }) => {
  return (
    <div className="flex h-full w-full rounded-sm bg-bg-surface-nested p-2">
      <svg viewBox="0 0 232 142" className="h-full w-full" aria-hidden focusable="false">
        <rect x="0" y="0" width="232" height="142" rx="4" fill="var(--bg-surface-container)" />

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
          fill="color-mix(in srgb, var(--fg-success) 8%, transparent)"
          stroke="var(--stroke-success)"
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
  hasSupportedSizes = true,
  onSelectSize,
  onAdd,
  onOpen,
}: {
  card: WidgetCardDefinition;
  /** When set, replaces generic i18n title/description (e.g. product manifest from browse-sdk). */
  copy?: AddWidgetModalCardCopy;
  selectedVariant: WidgetSizeIconVariant;
  isWidgetAlreadyOnDashboard: boolean;
  hasSupportedSizes?: boolean;
  onSelectSize: (variant: WidgetSizeIconVariant) => void;
  onAdd: VoidFunction;
  onOpen: VoidFunction;
}) => {
  const { t } = useTranslation();
  const title = copy?.title ?? t(card.titleKey);
  const description = copy?.description ?? t(card.descriptionKey);

  return (
    <article className="flex items-stretch overflow-hidden rounded-lg border border-stroke-primary bg-bg-surface-container">
      <div className="flex h-39.5 w-62 shrink-0 bg-bg-surface-nested">
        <WidgetCardPreview variant={selectedVariant} />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-9.5 p-4">
        <div className="flex flex-col gap-1 pt-1">
          <div className="text-base leading-6 font-semibold text-fg-primary">{title}</div>
          <div className="text-sm leading-4.5 font-normal text-fg-secondary">{description}</div>
        </div>

        {hasSupportedSizes ? (
          <div className="flex w-full items-center justify-between gap-4 pb-0.5">
            <SegmentedControl.Root
              label={t('feature.dashboard.widgetMenu.sizeLabel')}
              value={selectedVariant}
              onChange={value => {
                const variant = card.sizeVariants.find(item => item === value);
                if (variant) onSelectSize(variant);
              }}
            >
              {card.sizeVariants.map(variant => (
                <SegmentedControl.Item key={variant} value={variant} disabled={isWidgetAlreadyOnDashboard}>
                  {t(WIDGET_SIZE_CONFIG[variant].labelKey)}
                </SegmentedControl.Item>
              ))}
            </SegmentedControl.Root>

            <Button
              variant="primary"
              type="button"
              aria-label={
                isWidgetAlreadyOnDashboard ? t('feature.dashboard.addWidget.open') : t('feature.dashboard.addWidget.add')
              }
              onClick={isWidgetAlreadyOnDashboard ? onOpen : onAdd}
            >
              {isWidgetAlreadyOnDashboard ? t('feature.dashboard.addWidget.open') : t('feature.dashboard.addWidget.add')}
            </Button>
          </div>
        ) : (
          <div className="flex w-full items-center pb-0.5">
            <p className="text-sm leading-5 font-normal text-fg-secondary">{t('feature.dashboard.addWidget.noSupportedSizes')}</p>
          </div>
        )}
      </div>
    </article>
  );
};
