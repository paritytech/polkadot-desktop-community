import { type FC, type ReactNode, type SVGProps, useState } from 'react';

import { DropdownMenu } from '@/shared/components';
import {
  CheckIcon,
  EllipsisIcon,
  FrameBlockMediumIcon16,
  FrameBlockSmallIcon16,
  FrameBlockTallIcon16,
  FrameBlockWideIcon16,
  LayoutDashboardIcon,
  TrashIcon,
} from '@/shared/icons';
import { TEST_IDS } from '@/shared/test-ids';
import { useTranslation } from '@/shared/translation';
import { type WidgetSizeIconVariant } from '@/domains/application';
import { WIDGET_SIZE_CONFIG } from '../constants';
import { type WidgetSize } from '../types';

import { WidgetTopbarAction } from './WidgetTopbarAction';

const WIDGET_SIZE_ICON: Record<WidgetSizeIconVariant, FC<SVGProps<SVGSVGElement>>> = {
  small: FrameBlockSmallIcon16,
  medium: FrameBlockMediumIcon16,
  large: FrameBlockTallIcon16,
  horizontal: FrameBlockWideIcon16,
};

type WidgetMenuProps = {
  sizes: WidgetSizeIconVariant[];
  currentSize: WidgetSize;
  isSizeLocked?: boolean;
  removeLabel: ReactNode;
  // Extra menu entries contributed by the card feature (e.g. Reload), rendered
  // just above the destructive Remove item.
  menuItems?: ReactNode;
  onResize: (size: WidgetSize) => void;
  onRemove: VoidFunction;
  onCleanup?: VoidFunction;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export const WidgetMenu = ({
  sizes,
  currentSize,
  isSizeLocked = false,
  removeLabel,
  menuItems,
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

  // Locked → still show the single current size (checked); otherwise only show
  // the section when there's a real choice to make.
  const showSizeSection = isSizeLocked ? sizes.length > 0 : sizes.length > 1;

  return (
    <DropdownMenu.Root open={isOpen} onOpenChange={handleOpenChange}>
      <DropdownMenu.Trigger asChild>
        <WidgetTopbarAction label={t('common.action.moreDetails')} data-testid={TEST_IDS.dashboardWidgetMenuTrigger}>
          <EllipsisIcon />
        </WidgetTopbarAction>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="end">
        <div className="w-52.5">
          {showSizeSection ? (
            <>
              <div className="px-2 pt-2 pb-1 text-xs tracking-[0.96px] text-fg-secondary uppercase">
                {t('feature.dashboard.widgetMenu.sizeLabel')}
              </div>

              {sizes.map(variant => {
                const { size, labelKey } = WIDGET_SIZE_CONFIG[variant];
                const isActive = currentSize.w === size.w && currentSize.h === size.h;
                const SizeIcon = WIDGET_SIZE_ICON[variant];

                return (
                  <DropdownMenu.Item
                    key={variant}
                    disabled={isSizeLocked}
                    onClick={isSizeLocked ? undefined : handleResize(variant)}
                  >
                    <SizeIcon className="size-4" />
                    <span className="flex-1">{t(labelKey)}</span>
                    {isActive ? <CheckIcon className="size-4" /> : null}
                  </DropdownMenu.Item>
                );
              })}
            </>
          ) : null}

          {onCleanup ? (
            <>
              <DropdownMenu.Separator />

              <DropdownMenu.Item onClick={onCleanup}>
                <LayoutDashboardIcon className="size-4" />
                <span className="flex-1">{t('feature.dashboard.widgetMenu.cleanup')}</span>
              </DropdownMenu.Item>
            </>
          ) : null}

          <DropdownMenu.Separator />

          {menuItems}

          <DropdownMenu.Item data-testid={TEST_IDS.dashboardWidgetMenuRemove} variant="danger" onClick={onRemove}>
            <TrashIcon className="size-4" />
            <span className="flex-1">{removeLabel}</span>
          </DropdownMenu.Item>
        </div>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
};
