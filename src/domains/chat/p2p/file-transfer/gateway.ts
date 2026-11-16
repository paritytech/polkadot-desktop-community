/**
 * File upload for P2P chat using the HOP (Handoff Pool) protocol.
 *
 * Upload: file bytes → encrypted chunks → HOP relay → { identifier, claimTicket }
 *
 * HOP methods (hop_submit, hop_claim) are served by the bulletin chain node,
 * not the statement store people chain.
 *
 * IMPORTANT: The HOP pool is per-node (not replicated across chain nodes).
 * All devices must connect to the same bulletin node for file transfer to work.
 * We use createWsJsonRpcProvider directly (bypassing chainRegistry) with a
 * single-endpoint URL to avoid load-balancer routing to different nodes.
 *
 * Endpoints arrive as a parameter — resolving them is `chat/$usecase/fileTransfer.ts`'s
 * job, because a gateway may not call a use case.
 *
 * There is no download counterpart: the HOP claim is one-shot, so claiming on
 * desktop would deny the mobile recipient. `AttachmentRenderer` renders a
 * placeholder instead.
 */

import { type HopClient, createHopClient, uploadFile as hopUploadFile } from '@novasamatech/handoff-service';
import { createLazyClient } from '@novasamatech/statement-store';

import { createWsJsonRpcProvider } from '@/shared/chain-connection';
import { type FileAttachment, type FileMeta } from '../../session/types';

// TODO(p2p-chat): paseo-next uses a Cloudflare-proxied URL that may route different desktop
// clients to different bulletin chain nodes. Files uploaded on node A are inaccessible from
// node B, causing image/file downloads to fail between desktops. Fix requires one of:
//   1. Replace with a direct single-node URL (like preview/stable)
//   2. Configure Cloudflare sticky sessions for this endpoint
//   3. Replicate the HOP pool across bulletin chain nodes
// Android/iOS get their endpoint from Firebase Remote Config which may already point to a
// specific node — explaining why mobile→desktop file sending works.

let cachedHopClient: HopClient | null = null;
let cachedEndpointsKey = '';

// Keyed by the endpoint list itself rather than an environment id: the connection
// depends on the endpoints, so a switch that leaves them unchanged needn't reconnect.
const getHopClient = (endpoints: string[]): HopClient => {
  const key = endpoints.join('|');
  if (cachedHopClient && cachedEndpointsKey === key) return cachedHopClient;

  const provider = createWsJsonRpcProvider({ endpoints });
  const lazyClient = createLazyClient(provider);

  cachedHopClient = createHopClient(lazyClient.getRequestFn());
  cachedEndpointsKey = key;

  return cachedHopClient;
};

export type FileUploadInput = {
  file: File;
  meta: FileMeta;
  hopEndpoints: string[];
  onProgress?: (sent: number, total: number) => void;
};

async function uploadFile(input: FileUploadInput): Promise<FileAttachment> {
  const { file, meta, hopEndpoints, onProgress } = input;
  const data = new Uint8Array(await file.arrayBuffer());

  const result = await hopUploadFile({
    data,
    hopClient: getHopClient(hopEndpoints),
    onProgress,
  });

  if (result.isErr()) {
    console.error('[file-transfer] upload FAILED:', result.error.message);
    throw new Error(`File upload failed: ${result.error.message}`);
  }

  return {
    identifier: result.value.identifier,
    claimTicket: result.value.claimTicket,
    // Stamp the endpoint we uploaded through so the receiver can verify it
    // matches their hop allowlist before fetching the blob (Android does the
    // same — see ChatMessageStatementContent.scale.kt).
    nodeEndpoint: hopEndpoints[0],
    meta,
  };
}

export const fileTransferGateway = { uploadFile };
