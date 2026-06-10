import { type AppListing } from '@parity/browse-sdk';

import { createQueryResource } from '@/shared/resource';
import { environmentUseCase } from '@/domains/application';

import { browseGateway } from './gateway';

type PublishedWidgetsParams = {
  environmentId: string;
};

export const publishedWidgetListingsResource = createQueryResource<PublishedWidgetsParams>({
  key: ({ environmentId }) => `published-widgets:${environmentId}`,
})
  .request<AppListing[]>(() => browseGateway.listPublishedWidgets())
  .timeout(30_000)
  .cache<AppListing[]>({
    initial: [],
    map: (_cache, response) => response,
    staleAfter: 60_000,
  })
  .build();

export const publishedWidgetListingsParams = async (): Promise<PublishedWidgetsParams> => ({
  environmentId: (await environmentUseCase.getActive()).id,
});
