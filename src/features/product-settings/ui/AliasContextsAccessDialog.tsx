import { Link2 } from 'lucide-react';

import { useTranslation } from '@/shared/translation';
import { type AliasPermission, type PermissionStatus } from '@/domains/product';

import { PermissionEntriesDialog } from './PermissionEntriesDialog';

type Props = {
  productName: string;
  open: boolean;
  aliasPermissions: AliasPermission[];
  onOpenChange: (open: boolean) => void;
  onStatusChange: (aliasPermission: AliasPermission, status: PermissionStatus) => void;
};

const keyOf = (permission: AliasPermission) => `${permission.requesterProductId}:${permission.requestedContextId}`;

export const AliasContextsAccessDialog = ({ productName, open, aliasPermissions, onOpenChange, onStatusChange }: Props) => {
  const { t } = useTranslation();

  const entries = aliasPermissions.map(permission => ({
    key: keyOf(permission),
    label: permission.requestedContextId,
    status: permission.status,
  }));

  const handleStatusChange = (key: string, status: PermissionStatus) => {
    const target = aliasPermissions.find(permission => keyOf(permission) === key);
    if (target) onStatusChange(target, status);
  };

  return (
    <PermissionEntriesDialog
      open={open}
      title={t('feature.productSettings.aliasPermission.dialogTitle', { productName })}
      icon={<Link2 size={20} />}
      entries={entries}
      onOpenChange={onOpenChange}
      onStatusChange={handleStatusChange}
    />
  );
};
