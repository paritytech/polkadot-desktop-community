/**
 * File transfer service for P2P chat using the HOP (Handoff Pool) protocol.
 *
 * Upload: file bytes → encrypted chunks → HOP relay → { identifier, claimTicket }
 * Download: { identifier, claimTicket } → HOP relay → decrypted bytes → Blob URL
 *
 * HOP methods (hop_submit, hop_claim) are served by the bulletin chain node,
 * not the statement store people chain.
 *
 * IMPORTANT: The HOP pool is per-node (not replicated across chain nodes).
 * All devices must connect to the same bulletin node for file transfer to work.
 * We use createWsJsonRpcProvider directly (bypassing chainRegistry) with a
 * single-endpoint URL to avoid load-balancer routing to different nodes.
 */

import { type HopClient, createHopClient, downloadFile, uploadFile } from '@novasamatech/handoff-service';
import { createWsJsonRpcProvider } from '@novasamatech/host-substrate-chain-connection';
import { createLazyClient } from '@novasamatech/statement-store';

import { environmentUseCase } from '@/domains/application';
import { type FileAttachment, type FileMeta } from '../../session/types';
import { p2pChatDatabase } from '../repository';

// TODO(p2p-chat): paseo-next uses a Cloudflare-proxied URL that may route different desktop
// clients to different bulletin chain nodes. Files uploaded on node A are inaccessible from
// node B, causing image/file downloads to fail between desktops. Fix requires one of:
//   1. Replace with a direct single-node URL (like preview/stable)
//   2. Configure Cloudflare sticky sessions for this endpoint
//   3. Replicate the HOP pool across bulletin chain nodes
// Android/iOS get their endpoint from Firebase Remote Config which may already point to a
// specific node — explaining why mobile→desktop file sending works.

let cachedHopClient: HopClient | null = null;
let cachedEnvironmentId: string | null = null;

const getHopClient = async (): Promise<HopClient> => {
  const environment = await environmentUseCase.getActive();
  if (cachedHopClient && cachedEnvironmentId === environment.id) return cachedHopClient;

  const endpoints = environment.bulletinHopEndpoints;
  if (!endpoints?.length) throw new Error(`No HOP endpoint configured for environment: ${environment.id}`);

  const provider = createWsJsonRpcProvider({ endpoints });
  const lazyClient = createLazyClient(provider);

  cachedHopClient = createHopClient(lazyClient.getRequestFn());
  cachedEnvironmentId = environment.id;

  return cachedHopClient;
};

/**
 * Create a fresh HOP client with a new WebSocket connection.
 * Used on download retries so Cloudflare may route to a different backend node
 * that has the requested file data.
 *
 * `endpointUrl`, when supplied, pins the client to a single WSS URL — used
 * when the attachment carries a sender-stamped `nodeEndpoint` (Android/iOS
 * stamp the hop they uploaded to, so the receiver fetches from the same
 * node rather than its own load-balanced default).
 */
const createFreshHopClient = async (endpointUrl?: string): Promise<HopClient> => {
  const environment = await environmentUseCase.getActive();
  const endpoints = endpointUrl ? [endpointUrl] : environment.bulletinHopEndpoints;
  if (!endpoints?.length) throw new Error(`No HOP endpoint configured for environment: ${environment.id}`);

  const provider = createWsJsonRpcProvider({ endpoints });
  const lazyClient = createLazyClient(provider);

  return createHopClient(lazyClient.getRequestFn());
};

export type FileUploadInput = {
  file: File;
  meta: FileMeta;
  onProgress?: (sent: number, total: number) => void;
};

export type FileUploadResult = FileAttachment;

export const uploadChatFile = async (input: FileUploadInput): Promise<FileUploadResult> => {
  const { file, meta, onProgress } = input;
  const data = new Uint8Array(await file.arrayBuffer());

  const result = await uploadFile({
    data,
    hopClient: await getHopClient(),
    onProgress,
  });

  if (result.isErr()) {
    console.error('[file-transfer] upload FAILED:', result.error.message);
    throw new Error(`File upload failed: ${result.error.message}`);
  }

  // Stamp the endpoint we uploaded through so the receiver can verify it
  // matches their hop allowlist before fetching the blob (Android does the
  // same — see ChatMessageStatementContent.scale.kt). Falls back to undefined
  // if the environment somehow has no endpoints; the wire encoder will then
  // pick whichever is current at send-time.
  const endpoints = (await environmentUseCase.getActive()).bulletinHopEndpoints;
  const nodeEndpoint = endpoints?.[0];

  return {
    identifier: result.value.identifier,
    claimTicket: result.value.claimTicket,
    nodeEndpoint,
    meta,
  };
};

// In-memory cache: hex(identifier) → blob URL
const blobUrlCache = new Map<string, string>();

// Per-session negative cache: identifiers we've already proven are gone from
// the HOP pool (server returned "Data not found" after retries). The HOP pool
// is one-shot, so once a claim has consumed an entry — or it expired off the
// server — there is no recovery; re-trying on every AttachmentRenderer mount
// just hammers the server. We forget on app reload (cheap retry once per
// cold start in case we were wrong).
const negativeCache = new Set<string>();

const toHexKey = (bytes: Uint8Array): string => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');

// `hop_claim` evicts the entry on success, so retries must be sequential —
// running parallel claims would have one worker eat the entry while the
// others race against an empty slot and surface false "not found"s. A
// single fresh WSS per attempt is enough now that the SDK signs the
// canonical claim payload (`blake2b256("hop-claim-v1:" || hash)`); the
// previous retry loop was papering over a signature-rejection that
// surfaced as "Data not found".
const DOWNLOAD_MAX_RETRIES = 3;
const DOWNLOAD_RETRY_DELAY_MS = 1500;

const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

const blobUrlFromBytes = (bytes: Uint8Array | ArrayBuffer, mimeType: string): string => {
  // Dexie/IndexedDB round-trips Uint8Array but some browsers / Electron
  // versions hand back a plain ArrayBuffer. Normalise before slicing.
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const blob = new Blob([view.slice().buffer], { type: mimeType });
  return URL.createObjectURL(blob);
};

export const downloadChatFile = async (attachment: FileAttachment): Promise<string> => {
  const cacheKey = toHexKey(attachment.identifier);
  const cached = blobUrlCache.get(cacheKey);
  if (cached) return cached;

  // Persisted cache: `hop_claim` evicts the entry server-side on success,
  // so a chat reopen would otherwise 404. Stash decrypted bytes in
  // IndexedDB and rebuild the blob URL on every cold start.
  const persisted = await p2pChatDatabase.downloadedFiles.get(cacheKey).catch(() => undefined);
  if (persisted) {
    const url = blobUrlFromBytes(persisted.bytes, persisted.mimeType);
    blobUrlCache.set(cacheKey, url);
    return url;
  }

  if (negativeCache.has(cacheKey)) {
    throw new Error('File download failed: Data not found (cached)');
  }

  // When the sender stamped a hop endpoint (Android/iOS attachments do),
  // pin every connection to that URL: the HOP pool is per-node, so the
  // file only exists on the sender's chosen hop. Falls back to the local
  // environment's default endpoint for legacy attachments that predate
  // the field.
  const pinnedEndpoint = attachment.nodeEndpoint;

  for (let attempt = 0; attempt <= DOWNLOAD_MAX_RETRIES; attempt++) {
    if (attempt > 0) await delay(DOWNLOAD_RETRY_DELAY_MS);
    const hopClient = await createFreshHopClient(pinnedEndpoint);
    const result = await downloadFile({
      identifier: attachment.identifier,
      claimTicket: attachment.claimTicket,
      hopClient,
    });
    if (result.isOk()) {
      const bytes = result.value;
      const mimeType = attachment.meta.mimeType;
      // Best-effort persist. We have the bytes in hand right now and the
      // user expects to see the image — a Dexie failure (quota, schema
      // migration race) must not deny the in-session render. The downside
      // of a failed write is that the next chat reopen re-claims, which
      // won't succeed because hop_claim evicted the entry; the user gets
      // a one-time view this session. Worth it over hiding the file.
      try {
        await p2pChatDatabase.downloadedFiles.put({
          identifierHex: cacheKey,
          mimeType,
          bytes,
          downloadedAt: Date.now(),
        });
      } catch (e) {
        console.warn('[file-transfer] persist FAILED for %s: %s', cacheKey.slice(0, 16), e instanceof Error ? e.message : e);
      }
      const url = blobUrlFromBytes(bytes, mimeType);
      blobUrlCache.set(cacheKey, url);
      return url;
    }
    const message = result.error.message;
    if (!message.includes('not found')) {
      console.error('[file-transfer] download FAILED (permanent):', message);
      throw new Error(`File download failed: ${message}`);
    }
    if (attempt === DOWNLOAD_MAX_RETRIES) {
      console.error('[file-transfer] download FAILED after %d retries: %s', DOWNLOAD_MAX_RETRIES, message);
      negativeCache.add(cacheKey);
      throw new Error(`File download failed: ${message}`);
    }
  }

  throw new Error('File download failed: unexpected');
};
