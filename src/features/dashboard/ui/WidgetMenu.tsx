import { DropdownMenu } from '@novasamatech/tr-ui';
import { Check, LayoutDashboard, MoreHorizontal, Trash2 } from 'lucide-react';
import { type ReactNode, useState } from 'react';

import { useTranslation } from '@/shared/translation';
import { cnTw } from '@/shared/utils';
import { type WidgetSizeIconVariant } from '@/domains/application';
import { WIDGET_SIZE_CONFIG } from '../constants';
import { type WidgetSize } from '../types';

import { WidgetSizeIcon } from './icons/WidgetSizeIcon';

export const widgetTopbarActionVisibilityClass = cnTw(
  'widget-topbar-action inline-flex shrink-0 opacity-0 transition-opacity group-hover/widget:opacity-100 group-[.widget-topbar-menu-open]/widget:opacity-100 focus-visible:opacity-100',
);

export const widgetTopbarActionButtonClass = cnTw(
  'widget-topbar-action flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-full text-text-primary transition-colors hover:bg-bg-action-secondary-hover focus-visible:bg-bg-action-secondary-hover focus-visible:ring-[4px] focus-visible:ring-border-tertiary/35 focus-visible:ring-offset-0 focus-visible:outline-none',
);

export const widgetTopbarActionMenuTriggerClass = cnTw(
  widgetTopbarActionButtonClass,
  'data-[state=open]:bg-bg-action-secondary-hover',
);

type WidgetMenuProps = {
  sizes: WidgetSizeIconVariant[];
  currentSize: WidgetSize;
  removeLabel: ReactNode;
  onResize: (size: WidgetSize) => void;
  onRemove: VoidFunction;
  onCleanup?: VoidFunction;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export const WidgetMenu = ({
  sizes,
  currentSize,
  removeLabel,
  onResize,
  onRemove,
  onCleanup,
  isOpen: controlledIsOpen,
  onOpenChange: controlledOnOpenChange,
}: WidgetMenuProps) => {
  const { t } = useTranslation();
  const [uncontrolledIsOpen, setUncontrolledIsOpen] = useState(false);

  const isOpen = controlledIsOpen ?? uncontrolledIsOpen;
  const handleOpenChange = controlledOnOpenChange ?? setUncontrolledIsOpen;

  const handleResize = (variant: WidgetSizeIconVariant) => () => onResize(WIDGET_SIZE_CONFIG[variant].size);

  return (
    <DropdownMenu open={isOpen} onOpenChange={handleOpenChange}>
      <span className={widgetTopbarActionVisibilityClass}>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            className={widgetTopbarActionMenuTriggerClass}
            aria-label={t('common.action.moreDetails')}
            onMouseDown={event => event.stopPropagation()}
          >
            <MoreHorizontal className="size-4" aria-hidden />
          </button>
        </DropdownMenu.Trigger>
      </span>
      <DropdownMenu.Content align="end">
        <div className="w-52.5">
          {sizes.length > 1 ? (
            <>
              <div className="px-2 pt-2 pb-1 text-[12px] leading-4 font-normal tracking-[0.96px] text-text-secondary uppercase">
                {t('feature.dashboard.widgetMenu.sizeLabel')}
              </div>

              {sizes.map(variant => {
                const { size, labelKey } = WIDGET_SIZE_CONFIG[variant];
                const isActive = currentSize.w === size.w && currentSize.h === size.h;

                return (
                  <DropdownMenu.Item key={variant} onClick={handleResize(variant)}>
                    <div className="flex h-8 w-full items-center gap-2 rounded-md">
                      <WidgetSizeIcon variant={variant} className="size-4" />
                      <span className="flex-1 text-sm leading-5 font-medium text-text-primary">{t(labelKey)}</span>
                      {isActive ? <Check className="size-4" /> : null}
                    </div>
                  </DropdownMenu.Item>
                );
              })}
            </>
          ) : null}

          {onCleanup ? (
            <>
              <DropdownMenu.Separator />

              <DropdownMenu.Item onClick={onCleanup}>
                <div className="flex h-8 w-full items-center gap-2 rounded-md">
                  <LayoutDashboard className="size-4" />
                  <span className="flex-1 text-sm leading-5 font-medium text-text-primary">
                    {t('feature.dashboard.widgetMenu.cleanup')}
                  </span>
                </div>
              </DropdownMenu.Item>
            </>
          ) : null}

          <DropdownMenu.Separator />

          <DropdownMenu.Item variant="destructive" onClick={onRemove}>
            <div className="flex h-8 w-full items-center gap-2 rounded-md">
              <Trash2 className="size-4 text-fg-error" />
              <span className="flex-1 text-sm leading-5 font-medium">{removeLabel}</span>
            </div>
          </DropdownMenu.Item>
        </div>
      </DropdownMenu.Content>
    </DropdownMenu>
  );
};
