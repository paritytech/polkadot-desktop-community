import { Button, DropdownMenu } from '@novasamatech/tr-ui';
import { useNavigate } from '@tanstack/react-router';
import { MoreHorizontal, Settings } from 'lucide-react';
import { useCallback, useState } from 'react';

import { Slot } from '@/shared/di';
import { TEST_IDS } from '@/shared/test-ids';
import { useTranslation } from '@/shared/translation';
import { cnTw } from '@/shared/utils';
import { productActionsMenuItemsSlot } from '../di';

type Props = {
  productId: string;
  isFocused: boolean;
};

export const ProductActionsMenu = ({ productId, isFocused }: Props) => {
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
          tabIndex={isFocused ? -1 : 0}
          className={cnTw(
            '-mr-1 -ml-2 flex size-6 shrink-0 items-center justify-center rounded-full transition-[colors,opacity] duration-200 hover:bg-bg-action-secondary-hover',
            isFocused && 'hidden',
          )}
          onMouseDown={e => e.preventDefault()}
        >
          <MoreHorizontal className="size-4 text-text-secondary" aria-hidden />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="start">
        <div className="flex w-[210px] flex-col gap-0.5 p-1">
          <Slot id={productActionsMenuItemsSlot} props={{ productId, closeMenu }} />
          <div className="px-1 pt-1">
            <Button
              data-testid={TEST_IDS.productActionsMenuOpenSettings}
              variant="outline"
              fullWidth
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
