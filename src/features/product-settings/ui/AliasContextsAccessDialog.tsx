import { Link2Icon } from '@/shared/icons';
import { useTranslation } from '@/shared/translation';
import { type GrantedAccountAccess, type PermissionStatus } from '@/domains/product';

import { PermissionEntriesDialog } from './PermissionEntriesDialog';

type Props = {
  productName: string;
  open: boolean;
  /** Products whose account context this product may access, as the core holds them. */
  accountAccess: GrantedAccountAccess[];
  onOpenChange: (open: boolean) => void;
  onStatusChange: (targetProductId: string, status: PermissionStatus) => void;
};

export const AliasContextsAccessDialog = ({ productName, open, accountAccess, onOpenChange, onStatusChange }: Props) => {
  const { t } = useTranslation();

  const entries = accountAccess.map(({ targetProductId, status }) => ({
    key: targetProductId,
    label: targetProductId,
    status,
  }));

  return (
    <PermissionEntriesDialog
      open={open}
      title={t('feature.productSettings.aliasPermission.dialogTitle', { productName })}
      icon={<Link2Icon className="size-5" />}
      entries={entries}
      onOpenChange={onOpenChange}
      onStatusChange={onStatusChange}
    />
  );
};
