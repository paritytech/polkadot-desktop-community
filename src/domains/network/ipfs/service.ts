import { decode, getCodec } from '@ensdomains/content-hash';
import { CarReader } from '@ipld/car';
import * as dagPb from '@ipld/dag-pb';
import { blake2b } from '@noble/hashes/blake2.js';
import { fromHex, toHex } from '@novasamatech/scale';
import { UnixFS } from 'ipfs-unixfs';
import { CID } from 'multiformats/cid';
import { create } from 'multiformats/hashes/digest';

import { type HexString } from '@/shared/types';

import { type ArchiveContent } from './types';

const BLAKE2B_256_MULTIHASH_CODE = 0xb220;
const RAW_CID_CODEC = 0x55;

function isCarFile(buffer: Uint8Array) {
  if (buffer.length < 10) return false;

  let offset = 0;
  let shift = 0;
  let headerLen = 0;

  while (offset < buffer.length && offset < 9) {
    const byte = buffer[offset];
    if (byte === undefined) return false;
    headerLen |= (byte & 0x7f) << shift;
    offset++;
    if ((byte & 0x80) === 0) break;
    shift += 7;
  }

  if (buffer.length < offset + headerLen) return false;

  const headerStart = offset;
  // CBOR map with "roots" key
  return (
    buffer[headerStart] === 0xa2 &&
    buffer[headerStart + 1] === 0x65 &&
    buffer[headerStart + 2] === 0x72 &&
    buffer[headerStart + 3] === 0x6f &&
    buffer[headerStart + 4] === 0x6f &&
    buffer[headerStart + 5] === 0x74 &&
    buffer[headerStart + 6] === 0x73
  );
}

function concatBytes(chunks: Uint8Array[]): Uint8Array {
  const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

// Copy into a tight-fitting ArrayBuffer. Required before handing the array across
// an Electron IPC / structured-clone boundary: structured clone serializes the full
// underlying ArrayBuffer, and CarReader hands out subviews of the whole CAR buffer.
function detach(view: Uint8Array): Uint8Array {
  const copy = new Uint8Array(view.byteLength);
  copy.set(view);
  return copy;
}

function joinPath(base: string, name: string): string {
  return base ? `${base}/${name}` : name;
}

async function parseCarFile(buffer: Uint8Array): Promise<ArchiveContent> {
  const reader = await CarReader.fromBytes(buffer);
  const [rootCid] = await reader.getRoots();

  if (!rootCid) {
    throw new Error('CAR file has no roots');
  }

  const files: ArchiveContent = {};

  async function getChunkData(cid: CID): Promise<Uint8Array> {
    const block = await reader.get(cid);
    if (!block) return new Uint8Array(0);

    try {
      const node = dagPb.decode(block.bytes);
      return node.Data ? (UnixFS.unmarshal(node.Data).data ?? new Uint8Array(0)) : new Uint8Array(0);
    } catch {
      return block.bytes;
    }
  }

  async function processNode(cid: CID, path: string): Promise<void> {
    const block = await reader.get(cid);
    if (!block) return;

    const archiveKey = path;

    try {
      const node = dagPb.decode(block.bytes);
      const unixfs = node.Data ? UnixFS.unmarshal(node.Data) : null;
      const isDirectory = unixfs?.type === 'directory';
      const isFile = !unixfs || unixfs.type === 'file' || unixfs.type === 'raw';

      if (isDirectory || (!unixfs && node.Links.length > 0)) {
        for (const link of node.Links) {
          if (link.Name) {
            await processNode(link.Hash, joinPath(path, link.Name));
          }
        }
        return;
      }

      if (isFile) {
        if (node.Links.length === 0) {
          files[archiveKey] = unixfs?.data ? detach(unixfs.data) : new Uint8Array(0);
        } else {
          files[archiveKey] = concatBytes(await Promise.all(node.Links.map(link => getChunkData(link.Hash))));
        }
      }
    } catch {
      files[archiveKey] = detach(block.bytes);
    }
  }

  await processNode(rootCid, '');
  // Raw-codec deployments (and single-file directories) land under an empty key
  // because processNode starts the root with path=''. Main's saveArchiveFile
  // then rejects with "Invalid file path: empty". Promote that entry to
  // index.html so the archive is at least servable from its root — mirrors the
  // non-CAR fallback in parseIpfsResponse.
  if ('' in files) {
    files['index.html'] = files[''];
    delete files[''];
  }
  return files;
}

// Fallback when the response is not a CAR — surface it as an `index.html` so
// directory CIDs whose gateway serves the root document still produce a
// minimally-renderable archive.
async function parseIpfsResponse(response: Uint8Array): Promise<ArchiveContent> {
  return isCarFile(response) ? parseCarFile(response) : { 'index.html': response };
}

function decodeContenthash(contenthash: HexString): string | null {
  try {
    const codec = getCodec(contenthash);
    if (codec === 'ipfs') {
      return decode(contenthash);
    }
    return null;
  } catch {
    return null;
  }
}

// btoa over byte string blows the call stack for large inputs; chunked variant
// avoids that for icon/binary payloads.
function bytesToBase64(bytes: Uint8Array): string {
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(bytes.length, i + chunkSize));
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function toDataUrl(bytes: Uint8Array, format: 'png' | 'jpeg'): string {
  switch (format) {
    case 'png':
      return `data:image/png;base64,${bytesToBase64(bytes)}`;
    case 'jpeg':
      return `data:image/jpeg;base64,${bytesToBase64(bytes)}`;
    default:
      throw new Error(`Unsupported format: ${format}`);
  }
}

// A preimage is content stored via the Bulletin chain, addressed by the
// BLAKE2b-256 hash of its bytes; that same hash, wrapped as a raw-codec CIDv1,
// is its IPFS address. These compute the key and resolve the CID to fetch the bytes.
function computePreimageKey(data: Uint8Array): HexString {
  return toHex(blake2b(data, { dkLen: 32 }));
}

function hashToCid(hashHex: HexString): CID {
  return CID.createV1(RAW_CID_CODEC, create(BLAKE2B_256_MULTIHASH_CODE, fromHex(hashHex)));
}

function toIpfsCid(hashHex: HexString): string {
  return hashToCid(hashHex).toString();
}

export const ipfsService = {
  decodeContenthash,
  isCarFile,
  parseCarFile,
  parseIpfsResponse,
  toDataUrl,
  computePreimageKey,
  toIpfsCid,
};
