import { type ProductId } from '@parity/truapi';
import {
  type AuthState,
  type ExecutableKind,
  type PermissionAuthorizationRequest,
  type PermissionAuthorizationStatus,
  type RequiredHostCallbacks,
  type TrUApiProductProvider,
  type WorkerDemandChange,
} from '@parity/truapi-host';

/** The worker-backed runtime handle, narrowed to what the host actually calls. */
export type TruapiHostRuntime = {
  createProvider(product: { productId: ProductId; executionKind?: ExecutableKind }): Promise<TrUApiProductProvider>;
  disconnectSession(): Promise<void>;
  cancelPairing(): void;
  // Restores the session the core persisted, resolving once it is usable. Awaited at
  // boot: the core reports auth only on a *change*, so until this has run, silence
  // cannot be told apart from "signed out".
  activateStoredSession(): Promise<void>;
  getPermissionAuthorizationStatus(
    productId: ProductId,
    request: PermissionAuthorizationRequest,
  ): Promise<PermissionAuthorizationStatus>;
  getPermissionAuthorizationStatuses(
    productId: ProductId,
    requests: PermissionAuthorizationRequest[],
  ): Promise<PermissionAuthorizationStatus[]>;
  setPermissionAuthorizationStatus(
    productId: ProductId,
    request: PermissionAuthorizationRequest,
    status: PermissionAuthorizationStatus,
  ): Promise<void>;
  // The product's hard-subtree public key, cached by the core after the account holder
  // authorizes it once. `undefined` until that happens. The host derives a product
  // account's public key (and address) from this without ever seeing the private half.
  getProductSubtreePublicKey(productId: ProductId, timeoutMs?: number): Promise<Uint8Array | undefined>;
  /**
   * Take one reference on a product's worker. The core counts; the resulting level
   * reaches `subscribeWorkerDemand` listeners. Every call pairs with one release.
   */
  acquireWorker(productId: ProductId): void;
  /** Release one reference. Releasing with none held is a no-op. */
  releaseWorker(productId: ProductId): void;
  /**
   * Which product workers the host should be running. The listener first receives
   * `wanted: true` for every product wanted right now, then each change, and
   * `wanted: false` for every remaining product when the runtime is disposed.
   *
   * The core is the ledger — an open render holds a reference of its own — so this is
   * the only honest answer to "should this worker be running", and the host obeys it
   * rather than deciding from what happens to be mounted.
   */
  subscribeWorkerDemand(listener: (change: WorkerDemandChange) => void): () => void;
  dispose(): void;
};

export type TruapiRuntimeState = {
  runtime: TruapiHostRuntime | null;
  /** `null` until the core's first emission — distinct from `Disconnected`. */
  authState: AuthState | null;
  /**
   * True from the moment a full user logout begins until the renderer reloads.
   * The authenticated shell keeps a splash over itself while this holds, so the
   * teardown's intermediate signed-out renders and the onboarding redirect never
   * flash on screen. Only the reload clears it — by replacing the whole document.
   */
  loggingOut: boolean;
};

export type TruapiHostConfig = {
  host: {
    name: string;
    icon?: string;
    version?: string;
    /**
     * The kind of host, reported to products via `System.host_info`. Not sent in the
     * pairing handshake — the OS the phone shows comes from `platform` below.
     */
    platform: 'Desktop' | 'Web';
  };
  /**
   * The OS this host runs on (`macOS` + `26.1`), sent in the pairing handshake as the
   * `PlatformType` / `PlatformVersion` metadata so the mobile client can name this
   * device in its device list. Distinct from `host.platform`: a web build on macOS
   * reports `Web` there and `macOS` here. The key mirrors the core's config shape.
   */
  platform?: { type?: string; version?: string };
  people: { genesisHash: string | Uint8Array };
  bulletin: { genesisHash: string | Uint8Array };
  // Asset Hub carries the dotNS records the core reads session usernames from.
  assetHub: { genesisHash: string | Uint8Array };
  pairing: { deeplinkScheme: string };
};

/** Injection seam for tests; production supplies the real worker runtime. */
export type CreateRuntime = (callbacks: RequiredHostCallbacks, config: TruapiHostConfig) => Promise<TruapiHostRuntime>;
