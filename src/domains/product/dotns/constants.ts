// dotNS smart-contract surface used by the product domain. Both resolution
// paths — legacy `contenthash(node)` and the manifest-based two-level lookup
// — share this plumbing.

export const DOTNS_CONTENT_RESOLVER_ABI = [
  {
    inputs: [{ name: 'node', type: 'bytes32' }],
    name: 'contenthash',
    outputs: [{ name: '', type: 'bytes' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'node', type: 'bytes32' },
      { name: 'key', type: 'string' },
    ],
    name: 'text',
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

export const DOTNS_REGISTRY_ABI = [
  {
    inputs: [{ name: 'node', type: 'bytes32' }],
    name: 'resolver',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'node', type: 'bytes32' }],
    name: 'owner',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

// `ReviveApi.call` dry-run caps. The runtime ignores them for reads but the
// API surface requires concrete values.
export const DRY_RUN_WEIGHT_LIMIT = {
  ref_time: 18446744073709551615n,
  proof_size: 18446744073709551615n,
};
export const DRY_RUN_STORAGE_LIMIT = 18446744073709551615n;
