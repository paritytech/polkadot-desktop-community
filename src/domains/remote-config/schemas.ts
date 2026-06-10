import * as v from 'valibot';

// Firebase web-app credentials needed to initialize Remote Config. These are
// public client identifiers — the `apiKey` is NOT a secret and is safe to ship
// in the renderer. Injected from `VITE_FIREBASE_*` at the app boundary; this
// schema is the trust boundary that rejects a missing/blank config (in which
// case Remote Config stays disabled and reads return null/caller fallback).
export const firebaseConfigSchema = v.object({
  apiKey: v.pipe(v.string(), v.nonEmpty()),
  projectId: v.pipe(v.string(), v.nonEmpty()),
  appId: v.pipe(v.string(), v.nonEmpty()),
});

export type FirebaseConfig = v.InferOutput<typeof firebaseConfigSchema>;

// Generic URL validator for RAW-string params (`ipfs_gateway_url`,
// `identity_backend_url`). Domain-agnostic, so it lives here in the
// dependency-free remote-config domain and any consuming domain (network,
// chat, …) can import it without a dependency cycle.
export const remoteUrlSchema = v.pipe(v.string(), v.url());
