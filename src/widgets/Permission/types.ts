import { type LucideProps } from 'lucide-react';
import { type ReactElement } from 'react';

import { type PermissionId } from '@/domains/product';

export type PermissionCategory = 'device' | 'onchain' | 'service';

export type PermissionMetadata = {
  id: PermissionId;
  category: PermissionCategory;
  icon: ReactElement<Pick<LucideProps, 'size' | 'className'>>;
  labelKey: string;
  descriptionKey: string;
  ruleKeys: string[];
};
