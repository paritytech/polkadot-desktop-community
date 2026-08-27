/**
 * Compatibility helpers for Host Playground integration with the PWallet Rust core.
 *
 * These functions are intentionally narrow:
 * - `tryCanonicalizeSelfAlias` normalises only the exact self-alias form
 *   `${canonicalId}.dot` → `canonicalId` used when a dapp calls its own AccountGet.
 * - `RESERVED_PEOPL_DOT` is the single permitted off-network identifier, needed for
 *   the Account Holder SSO ring-VRF flows (alias, proof, list) used by Host Playground.
 */

/** Reserved Account Holder owner for Host Playground ring-VRF integrations. */
export const RESERVED_PEOPL_DOT = 'peopl.dot';

/**
 * Canonicalize a Host Playground self-alias `${canonicalId}.dot` back to `canonicalId`
 * before validation and subtree lookup. A bare dapp name still gets `.dot` appended
 * by the caller (e.g. `myapp.dot` → normalised back to `myapp` when `canonicalId` is `myapp`).
 * Already-qualified dotNS names (e.g. `host-playground.paseo`, `myapp.dot` where the
 * canonical name IS `myapp`) are also unchanged. Only the exact self-alias form is normalised.
 */
export function tryCanonicalizeSelfAlias(productAccountId: string, canonicalId: string): string {
  return productAccountId === `${canonicalId}.dot` ? canonicalId : productAccountId;
}

/**
 * Whether `identifier` is the single reserved Account Holder owner permitted in
 * Host Playground ring-VRF flows (getAlias, createProof, listRingVrfKeys).
 * No other off-network identifier is admitted.
 */
export function isReservedAccountHolder(identifier: string): boolean {
  return identifier === RESERVED_PEOPL_DOT;
}
