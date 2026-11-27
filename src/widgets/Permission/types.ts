import { type ReactElement, type SVGProps } from 'react';

import { type PermissionId } from '@/domains/product';

export type PermissionCategory = 'device' | 'onchain' | 'service';

export type PermissionMetadata = {
  id: PermissionId;
  category: PermissionCategory;
  icon: ReactElement<Pick<SVGProps<SVGSVGElement>, 'className'>>;
  labelKey: string;
  descriptionKey: string;
  ruleKeys: string[];
};
