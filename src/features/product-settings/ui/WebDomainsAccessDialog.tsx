import { SquareDashed } from 'lucide-react';

import { useTranslation } from '@/shared/translation';
import {
  type PermissionModality,
  type PermissionStatus,
  useProductExternalRequestPatterns,
  useSetRemotePermission,
} from '@/domains/product';
import { getModalityMeta } from '@/widgets/Permission';

import { PermissionEntriesDialog } from './PermissionEntriesDialog';

type Props = {
  productId: string;
  productName: string;
  modality: PermissionModality;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export const WebDomainsAccessDialog = ({ productId, productName, modality, open, onOpenChange }: Props) => {
  const { t } = useTranslation();
  const { data: patterns } = useProductExternalRequestPatterns(productId, modality);
  const setRemote = useSetRemotePermission();

  const entries = patterns.map(pattern => ({
    key: pattern.payload.pattern,
    label: pattern.payload.pattern,
    status: pattern.status,
  }));

  const handleStatusChange = (pattern: string, status: PermissionStatus) => {
    setRemote.run({
      productId,
      permission: { payload: { type: 'Remote', pattern }, modality, status },
    });
  };

  return (
    <PermissionEntriesDialog
      open={open}
      title={t('feature.productSettings.webDomains.dialogTitle', {
        productName,
        modality: t(getModalityMeta(modality).labelKey),
      })}
      icon={<SquareDashed size={20} />}
      entries={entries}
      onOpenChange={onOpenChange}
      onStatusChange={handleStatusChange}
    />
  );
};
