# Building, configuring & publishing

This guide explains how to configure the app, sign it, and distribute installable
builds with auto-update support.

> This repository intentionally ships **no hosted release pipeline**. What follows
> is a vendor-neutral description of how to configure, build, sign and distribute
> the app with the scripts included in this repo. Wire it into whichever CI system
> you prefer (GitHub Actions, GitLab CI, …). The repo keeps only development CI —
> linting (`lint.yaml`) and unit tests (`tests_unit.yaml`); there is no build,
> release, or end-to-end pipeline.

---

## 1. How configuration works

All endpoints, keys and toggles are externalised into **environment variables**
that Vite bakes into the three build targets (`main`, `preload`, `renderer`) at
build time. Nothing is hardcoded in the source.

| File           | Committed?    | Purpose                                                |
| -------------- | ------------- | ------------------------------------------------------ |
| `.env.example` | ✅ yes        | The full catalog of variables with placeholder values. |
| `.env`         | ❌ gitignored | Your local values. Copy from `.env.example`.           |

Variables prefixed `VITE_` reach the renderer; the rest are injected into the
main/preload bundles via `vite.config.*.ts` `define` blocks. Features whose
variables are empty stay disabled (crash reporting, auto-update, TURN relay,
Remote Config) — the app builds and runs without any of them.

> **In CI:** export the variables directly into the job environment from your
> secret store instead of creating a `.env` file.

---

## 2. Environment variables

### Secrets — set in `.env` or the CI environment

| Variable                  | Used for                                              | If empty                                |
| ------------------------- | ----------------------------------------------------- | --------------------------------------- |
| `SENTRY_DSN`              | Sentry crash/issue reporting (baked in at build time) | Crash reporting is disabled by default  |
| `VITE_WEBRTC_TURN_SECRET` | TURN relay credential for device-sync                 | STUN-only fallback (works on most NATs) |
| `BOT_TOKEN`               | Signing-bot API token for e2e auth tests              | Bot-backed e2e projects fail            |

### Signing & distribution — set in the CI environment (not needed for local dev)

| Variable                                                   | Used for                                                                                                                             |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID` | macOS notarization (`@electron/notarize`, runs during `npm run dist`)                                                                |
| `CERTIFICATE_OSX_APPLICATION`, `CERTIFICATE_PASSWORD`      | Base64 `.p12` Developer ID Application certificate + password, imported into the build keychain by `.github/add_cert_in_keychain.sh` |
| `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`        | Uploading sourcemaps to Sentry during the build (skipped when unset)                                                                 |
| `GITHUB_TOKEN` / `GH_TOKEN`                                | Fetching release notes for update metadata (`scripts/rewrite-update-metadata.js`)                                                    |

### Non-secret config — public values, set per build

| Variable                                                                      | What it is / where it's used                                                                                                                                                                                                                                                                        |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VITE_FIREBASE_API_KEY` / `VITE_FIREBASE_PROJECT_ID` / `VITE_FIREBASE_APP_ID` | Firebase Remote Config client identifiers (public, not secrets). Empty = Remote Config disabled and the app has no chain catalog — see section 3.                                                                                                                                                   |
| `VITE_ENVIRONMENTS`                                                           | JSON catalog of environment channels (see `.env.example` for the schema).                                                                                                                                                                                                                           |
| `VITE_WEBRTC_TURN_HOST`, `VITE_WEBRTC_TURN_TTL`                               | Your TURN relay host and credential TTL for device-sync.                                                                                                                                                                                                                                            |
| `SANDBOX_RELAY_ALLOWLIST`                                                     | Comma-separated TURN/STUN hostnames sandboxed product webviews may reach without a per-product permission prompt. Empty = no silent allowlist; every relay request goes through the prompt (fail-closed). Distinct from the device-sync TURN variables above — this gates what _products_ may dial. |
| `SANDBOX_IPFS_ALLOWLIST`                                                      | Comma-separated IPFS gateway hostnames sandboxed product webviews may GET without a per-product permission prompt. Empty = no silent allowlist; every IPFS fetch goes through the prompt (fail-closed). Set this when products should reach a known public gateway transparently.                   |
| `AUTO_UPDATE_URL`                                                             | Generic electron-updater feed URL. Empty = auto-update disabled.                                                                                                                                                                                                                                    |
| `BUILD_SOURCE`                                                                | How the build is distributed: `github` (GitHub Releases) or `s3` (static file server behind `AUTO_UPDATE_URL`). Controls whether the in-app updater is enabled.                                                                                                                                     |
| `LOGGER`                                                                      | Any non-empty value enables verbose logging in all three targets.                                                                                                                                                                                                                                   |
| `RENDERER_SOURCE`                                                             | `localhost` (dev server) or `filesystem` (built assets); build scripts set it for you.                                                                                                                                                                                                              |
| `BOT_URL`                                                                     | Signing-bot base URL for e2e tests (`vars.BOT_URL` in CI).                                                                                                                                                                                                                                          |

---

## 3. Firebase setup

All remotely-served configuration comes from Firebase **Remote Config**: the
`chains_v2` network catalog, `dot_ns_config` (dotNS contract addresses),
`ipfs_gateway_url`, and `identity_backend_url`. There are no committed
defaults — without a configured Firebase project the app has no chain catalog,
so for any real deployment Remote Config is effectively required.

1. Create a Firebase project and a web app in it; copy the client identifiers
   into the `VITE_FIREBASE_*` variables.
2. Create the Remote Config parameters (`chains_v2` is the JSON array of chain
   definitions). Per-channel values are served with Remote Config conditions:
   the app selects a channel by setting the `environment` custom signal, and
   the matching `Common <id> - signal` condition serves that channel's values.
3. The `VITE_ENVIRONMENTS` catalog maps channel ids to `chains_v2` entry ids —
   keep them in sync.

---

## 4. Build environments

| Command                 | `NODE_ENV`    | App id                       | Title                  |
| ----------------------- | ------------- | ---------------------------- | ---------------------- |
| `npm run build`         | `production`  | `com.polkadot.desktop`       | Polkadot Desktop       |
| `npm run build:staging` | `staging`     | `com.polkadot.desktop.stage` | Polkadot Desktop Stage |
| `npm run build:dev`     | `development` | — (not packaged)             | Polkadot Desktop       |

App id, title, protocol scheme (`polkadot:`) and window defaults live in
`config/index.js`; packaging configuration in `electron-builder.js`. Change the
app id to your own reverse-DNS identifier before distributing your fork.

---

## 5. Code signing & notarization

### macOS

You need an Apple Developer account and a **Developer ID Application**
certificate.

1. Export the certificate as `.p12`, base64-encode it, and provide it to CI as
   `CERTIFICATE_OSX_APPLICATION` (+ `CERTIFICATE_PASSWORD`).
2. `.github/add_cert_in_keychain.sh` imports it into a dedicated build keychain.
3. `electron-builder` signs with hardened runtime and the entitlements from
   `resources/entitlements/entitlements.mac.plist`, then notarizes
   (`notarize: true`) using `APPLE_ID` / `APPLE_APP_SPECIFIC_PASSWORD` /
   `APPLE_TEAM_ID`.

Unsigned local packaging works too — skip the variables and macOS Gatekeeper
will warn on first launch.

### Windows / Linux

Windows builds target NSIS and ship unsigned by default — add your own
`win.certificateFile`/`certificateSubjectName` to `electron-builder.js` if you
have a code-signing certificate. Linux builds target AppImage and need no
signing.

---

## 6. Build & package

```bash
# Production: clean, build all three targets, package installers
npm run prod:sequence

# Staging
npm run staging:sequence

# Or step by step
npm run build          # main + preload + renderer
npm run dist           # electron-builder (-p never: package only, no publish)
```

Installers land in `release/dist/`: `.dmg`/`.zip` (macOS, arm64 + x64),
`.AppImage` (Linux), `.exe` (Windows NSIS), plus electron-updater metadata
(`latest*.yml`) when `AUTO_UPDATE_URL` is set.

---

## 7. Auto-update hosting

The updater uses electron-updater's **generic provider**: any static file server
(S3-compatible storage, nginx, a CDN) that serves the artifacts and `latest*.yml`
metadata under `AUTO_UPDATE_URL` works.

- Build with `AUTO_UPDATE_URL` and `BUILD_SOURCE` set, otherwise the in-app
  updater stays disabled (`main/factories/updater.ts`).
- `scripts/rewrite-update-metadata.js` rewrites the metadata to stable,
  unversioned artifact paths (e.g. `Polkadot-Desktop.dmg` under a `/latest/`
  directory) and, when `GITHUB_TOKEN` + `VERSION` are set, injects GitHub
  release notes into the updater dialog. Set `ARTIFACTS_DIR` to the directory
  holding the packaged files.
- Upload both the versioned artifacts and the rewritten metadata to your update
  server.

---

## 8. Wiring it into CI

A typical release job:

1. Check out the repo, `npm ci`.
2. Export the build variables (section 2) from your secret store.
3. Import the macOS signing certificate into a keychain
   (`.github/add_cert_in_keychain.sh`).
4. `npm run prod:sequence` per OS/arch.
5. `node scripts/rewrite-update-metadata.js` over the artifacts.
6. Upload artifacts + metadata to your update server and/or create a GitHub
   Release.

Keep every credential in your CI provider's secret store — never commit `.env`,
certificates, service-account JSON, or API keys.
