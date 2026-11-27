import { useNavigate } from '@tanstack/react-router';
import { useCallback, useState } from 'react';

import EllipsisIcon from '@/shared/assets/images/icons/ellipsis.svg?jsx';
import SettingsIcon from '@/shared/assets/images/icons/settings.svg?jsx';
import { Button, DropdownMenu, IconButton } from '@/shared/components';
import { Slot } from '@/shared/di';
import { TEST_IDS } from '@/shared/test-ids';
import { useTranslation } from '@/shared/translation';
import { productActionsMenuItemsSlot } from '../di';

type Props = {
  productId: string;
};

export const ProductActionsMenu = ({ productId }: Props) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const closeMenu = useCallback(() => setOpen(false), []);

  return (
    <DropdownMenu.Root open={open} onOpenChange={setOpen}>
      <span className="-ms-2 -me-1 flex">
        <DropdownMenu.Trigger asChild>
          <IconButton
            size="sm"
            label={t('feature.productActionsMenu.trigger')}
            data-testid={TEST_IDS.productActionsMenuTrigger}
            onMouseDown={e => e.preventDefault()}
          >
            <EllipsisIcon />
          </IconButton>
        </DropdownMenu.Trigger>
      </span>
      <DropdownMenu.Content align="start">
        <div className="flex w-52.5 flex-col gap-0.5">
          <Slot id={productActionsMenuItemsSlot} props={{ productId, closeMenu }} />
          <div className="px-1 pt-1">
            <Button
              data-testid={TEST_IDS.productActionsMenuOpenSettings}
              horizontalSize="fill"
              onClick={() => {
                setOpen(false);
                void navigate({ to: '/settings/privacy/apps/$productId', params: { productId } });
              }}
            >
              <SettingsIcon className="size-4" />
              {t('feature.productActionsMenu.openSettings')}
            </Button>
          </div>
        </div>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
};
