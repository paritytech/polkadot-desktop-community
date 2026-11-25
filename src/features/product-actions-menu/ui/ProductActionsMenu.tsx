import { DropdownMenu } from '@novasamatech/tr-ui';
import { useNavigate } from '@tanstack/react-router';
import { MoreHorizontal, Settings } from 'lucide-react';
import { useCallback, useState } from 'react';

import { Button } from '@/shared/components';
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
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label={t('feature.productActionsMenu.trigger')}
          data-testid={TEST_IDS.productActionsMenuTrigger}
          data-no-app-focus
          className="-ms-2 -me-1 flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors duration-200 hover:bg-chrome-fill focus-visible:outline-2 focus-visible:outline-chrome-focus"
          onMouseDown={e => e.preventDefault()}
        >
          <MoreHorizontal className="size-4" aria-hidden />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="start">
        <div className="flex w-52.5 flex-col gap-0.5 p-1">
          <Slot id={productActionsMenuItemsSlot} props={{ productId, closeMenu }} />
          <div className="px-1 pt-1">
            <Button
              data-testid={TEST_IDS.productActionsMenuOpenSettings}
              block
              onClick={() => {
                setOpen(false);
                void navigate({ to: '/settings/privacy/apps/$productId', params: { productId } });
              }}
            >
              <Settings className="size-4" aria-hidden />
              {t('feature.productActionsMenu.openSettings')}
            </Button>
          </div>
        </div>
      </DropdownMenu.Content>
    </DropdownMenu>
  );
};
