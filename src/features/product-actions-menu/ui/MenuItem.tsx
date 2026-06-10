import { DropdownMenu } from '@novasamatech/tr-ui';
import { type ReactNode, memo } from 'react';

import { TEST_IDS } from '@/shared/test-ids';

type Props = {
  icon: ReactNode;
  label: ReactNode;
  onSelect: VoidFunction;
  variant?: 'default' | 'destructive';
  testId?: string;
};

export const MenuItem = memo<Props>(({ icon, label, onSelect, variant = 'default', testId }) => {
  return (
    <DropdownMenu.Item
      data-testid={testId ?? TEST_IDS.productActionsMenuItem}
      variant={variant}
      onSelect={event => {
        event.preventDefault();
        onSelect();
      }}
    >
      {icon}
      <span className="flex-1 text-sm leading-5 font-medium">{label}</span>
    </DropdownMenu.Item>
  );
});

MenuItem.displayName = 'MenuItem';
