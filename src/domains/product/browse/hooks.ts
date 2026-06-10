import { type AppListing } from '@parity/browse-sdk';

import { useRead } from '@/shared/hooks';

import { publishedWidgetListingsParams, publishedWidgetListingsResource } from './resource';

const EMPTY_WIDGET_LISTINGS: AppListing[] = [];

export const usePublishedWidgetListings = (enabled: boolean) => {
  const { data: params } = useRead(publishedWidgetListingsParams, {
    params: {},
    defaultValue: null,
  });

  return useRead(publishedWidgetListingsResource, {
    params: enabled ? params : null,
    defaultValue: EMPTY_WIDGET_LISTINGS,
  });
};
