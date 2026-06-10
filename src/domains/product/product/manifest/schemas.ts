import * as v from 'valibot';

// Wire-format Valibot schemas for the product manifest format (v1).
// These schemas validate JSON arriving across the dotNS trust boundary — every
// manifest the host parses MUST pass parsing here before any downstream use.

// SemVer tuple: [major, minor, patch, build?]
// `build` is an opaque string (e.g. commit hash, CI build id).
// 4-tuple variant is listed first so the union matches the longer shape before
// falling back to the 3-tuple — otherwise the build identifier would be dropped.
export const semVerSchema = v.union([
  v.tuple([v.number(), v.number(), v.number(), v.string()]),
  v.tuple([v.number(), v.number(), v.number()]),
]);

export type SemVer = v.InferOutput<typeof semVerSchema>;

// Formats the Host can actually render. An unknown `format` does NOT make the
// product undiscoverable — the icon degrades to a placeholder while the product
// stays launchable. So the wire schema accepts any string here and renderability
// is gated at draw time via `manifestService.isRenderableIconFormat`.
export const RENDERABLE_ICON_FORMATS = ['jpeg', 'png'] as const;
export type RenderableIconFormat = (typeof RENDERABLE_ICON_FORMATS)[number];

// Icon — raw Bulletin-chain CID + format hint.
export const iconSchema = v.object({
  cid: v.string(),
  format: v.string(),
});

export type Icon = v.InferOutput<typeof iconSchema>;

// Root manifest — product-wide metadata. Lives at the dotNS base name under the
// `manifest` text-record key.
export const rootManifestSchema = v.object({
  $v: v.literal(1),
  displayName: v.string(),
  description: v.string(),
  icon: iconSchema,
});

export type RootManifest = v.InferOutput<typeof rootManifestSchema>;

// Common fields shared by every executable manifest.
const commonExecutableFields = {
  $v: v.literal(1),
  appVersion: semVerSchema,
};

// App manifest — full-screen SPA. No fields beyond the common ones.
export const appManifestSchema = v.object({
  ...commonExecutableFields,
  kind: v.literal('app'),
});

export type AppManifest = v.InferOutput<typeof appManifestSchema>;

// Widget manifest — dashboard-mounted SPA with a dimensions hint.
export const widgetManifestSchema = v.object({
  ...commonExecutableFields,
  kind: v.literal('widget'),
  description: v.optional(v.string()),
  dimensions: v.object({
    height: v.array(v.number()),
    width: v.optional(v.number()),
  }),
});

export type WidgetManifest = v.InferOutput<typeof widgetManifestSchema>;

// Worker manifest — background JS process. `includes` declares which user-facing
// surfaces it serves. Both `chat` and `pocket` may be false: such a worker
// exposes no Pocket/Chat affordance and runs purely as background logic, but
// still launches — so neither flag is required.
export const workerManifestSchema = v.object({
  ...commonExecutableFields,
  kind: v.literal('worker'),
  entrypoint: v.string(),
  includes: v.object({
    chat: v.boolean(),
    pocket: v.boolean(),
  }),
});

export type WorkerManifest = v.InferOutput<typeof workerManifestSchema>;

// Executable manifest — discriminated union over `kind`.
export const executableManifestSchema = v.variant('kind', [appManifestSchema, widgetManifestSchema, workerManifestSchema]);

export type ExecutableManifest = v.InferOutput<typeof executableManifestSchema>;
