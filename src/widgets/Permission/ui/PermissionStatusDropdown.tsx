import { Check, ChevronDown } from 'lucide-react';

import { DropdownMenu } from '@/shared/components';
import { useTranslation } from '@/shared/translation';
import { type PermissionStatus } from '@/domains/product';
import { STATUS_LABEL_KEYS } from '../metadata';

const STATUSES: PermissionStatus[] = ['ask', 'granted', 'denied'];

type Props = {
  value: PermissionStatus;
  onChange: (value: PermissionStatus) => void;
};

export const PermissionStatusDropdown = ({ value, onChange }: Props) => {
  const { t } = useTranslation();

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button className="flex h-6 shrink-0 items-center gap-1 rounded border border-stroke-primary bg-bg-action-primary-inverted px-2 py-1">
          <span className="text-xs leading-4 font-medium text-fg-primary">{t(STATUS_LABEL_KEYS[value])}</span>
          <ChevronDown size={16} className="text-fg-tertiary" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="end">
        {STATUSES.map(option => (
          <DropdownMenu.Item key={option} onSelect={() => onChange(option)}>
            <span className="flex-1">{t(STATUS_LABEL_KEYS[option])}</span>
            {value === option && <Check size={16} />}
          </DropdownMenu.Item>
        ))}
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
};
