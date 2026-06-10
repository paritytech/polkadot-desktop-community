// Manifest-specific wire pins (product manifest format).
// dotNS plumbing — ABIs, dry-run limits, caller address, zero-address sentinel
// — lives in `../dotns/constants.ts`; the manifest module is just a consumer.

export const MANIFEST_TEXT_RECORD_KEY = 'manifest';
export const EXECUTABLE_TEXT_RECORD_KEY = 'executable';

// `kind` doubles as the subname label by spec — `app.<base>` carries
// `kind: 'app'`, etc. — so a separate label table would be pure redundancy.
export const EXECUTABLE_KINDS = ['app', 'widget', 'worker'] as const;
export type ExecutableKind = (typeof EXECUTABLE_KINDS)[number];
