// Product entity — canonical struct + persistence + service helpers.
export type { Product } from './types';
export { type PersistedProduct, productDb } from './repository';
export { productsResource } from './resource';
export {
  useDisplayedProduct,
  useIsPinned,
  useIsProductInstalled,
  usePersistedProductById,
  usePersistedProducts,
  useProductHeaderProps,
} from './hooks';
export type { ProductHeaderViewModel } from './hooks';
export { productService } from './service';

// Manifest sub-module — product manifest wire schemas + per-executable archive loader.
export { manifestService } from './manifest/service';
export { type ExecutableKind, EXECUTABLE_KINDS } from './manifest/constants';
export { executableArchiveResource, invalidateExecutableArchive } from './manifest/resource';
export { useExecutableArchive, useLiveExecutableContenthash, useProductIcon } from './manifest/hooks';
export type {
  AppExecutable,
  Executable,
  ExecutableContent,
  Icon,
  ProductArchive,
  ProductExecutables,
  RootManifest,
  WidgetExecutable,
  WorkerExecutable,
} from './manifest/types';
