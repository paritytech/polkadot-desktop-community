import { type ReactNode, memo } from 'react';

import { DropdownMenu } from '@/shared/components';
import { TEST_IDS } from '@/shared/test-ids';

type Props = {
  icon: ReactNode;
  label: ReactNode;
  onSelect: VoidFunction;
  testId?: string;
};

export const MenuItem = memo<Props>(({ icon, label, onSelect, testId }) => {
  return (
    <DropdownMenu.Item
      data-testid={testId ?? TEST_IDS.productActionsMenuItem}
      onSelect={event => {
        event.preventDefault();
        onSelect();
      }}
    >
      {icon}
      <span className="flex-1">{label}</span>
    </DropdownMenu.Item>
  );
});

MenuItem.displayName = 'MenuItem';
