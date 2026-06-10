import { type AppListing } from '@parity/browse-sdk';

import { dotNsService } from '../dotns/service';
import { manifestService } from '../product/manifest/service';
import { type RootManifest } from '../product/manifest/types';
import { type Product } from '../product/types';

function listingBaseName(listing: AppListing): string {
  return dotNsService.baseNameOf(listing.label);
}

function listingToRootManifest(manifest: AppListing['manifest']): RootManifest {
  return {
    $v: 1,
    displayName: manifest.displayName,
    description: manifest.description,
    icon: manifest.icon,
  };
}

/** Preview product for the add-widget modal before the user commits from chain. */
function productPreviewFromListing(listing: AppListing): Product {
  const baseName = listingBaseName(listing);
  return manifestService.assembleProduct({
    baseName,
    root: listingToRootManifest(listing.manifest),
    executables: {},
  });
}

function findListingByBaseName(listings: AppListing[], baseName: string): AppListing | undefined {
  return listings.find(listing => listingBaseName(listing) === baseName);
}

/** Prefer browse catalog manifest fields when the stored product is missing them. */
function enrichProductWithListing(product: Product, listing: AppListing | undefined): Product {
  if (!listing) return product;

  const fromListing = productPreviewFromListing(listing);
  const description = fromListing.description.trim() || product.description;

  return {
    ...product,
    displayName: fromListing.displayName || product.displayName,
    description,
    icon: product.icon.cid ? product.icon : fromListing.icon,
  };
}

export const browseService = {
  listingBaseName,
  findListingByBaseName,
  enrichProductWithListing,
  productPreviewFromListing,
};
