import { type AppListing } from '@/domains/product';
import { type AddableDashboardCard } from '../../di';

export type AddWidgetSidebarEntry =
  | { source: 'native'; id: string; card: AddableDashboardCard }
  | { source: 'published'; id: string; listing: AppListing; baseName: string };

export type AddWidgetModalCardCopy = {
  title: string;
  description: string;
};
