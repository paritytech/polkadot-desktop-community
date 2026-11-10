# Building, configuring & publishing

This guide explains how to configure the app, sign it, and distribute installable
builds with auto-update support.

> All endpoints, keys and toggles are externalised into **environment variables**.
> This repo ships a working release pipeline in `.github/workflows/release-pipeline.yml`
> (build → sign/notarize → GitHub Release) that you can read as the
> reference wiring; the sections below describe the same configuration
> vendor-neutrally so a fork can target any CI system or update host.

---

## 1. How configuration works

All endpoints, keys and toggles are externalised into **environment variables**
that Vite bakes into the three build targets (`main`, `preload`, `renderer`) at
build time. Nothing is hardcoded in the source.

| File           | Committed?    | Purpose                                                |
| -------------- | ------------- | ------------------------------------------------------ |
| `.env.example` | ✅ yes        | The full catalog of variables with placeholder values. |
| `.env.local`   | ❌ gitignored | Your local values. Copy from `.env.example`.           |

Variables prefixed `VITE_` reach the renderer; the rest are injected into the
main/preload bundles via `vite.config.*.ts` `define` blocks. Features whose
variables are empty stay disabled (crash reporting, auto-update, TURN relay,
Remote Config) — the app builds and runs without any of them, but **without
Remote Config it has no chain catalog and fails to boot** (see section 3).

> **In CI:** export the variables directly into the job environment from your
> secret store instead of creating a `.env.local` file. See
> `.github/actions/build-app/action.yml` for the exact mapping.

---

## 2. Environment variables

### Secrets — set in `.env.local` or the CI environment

| Variable                  | Used for                                              | If empty                                |
| ------------------------- | ----------------------------------------------------- | --------------------------------------- |
| `SENTRY_DSN`              | Sentry crash/issue reporting (baked in at build time) | Crash reporting is disabled by default  |
| `VITE_WEBRTC_TURN_SECRET` | TURN relay credential for device-sync                 | STUN-only fallback (works on most NATs) |

### Signing & distribution — set in the CI environment (not needed for local dev)

| Variable                                                   | Used for                                                                                                                             |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID` | macOS notarization (`@electron/notarize`, runs during `npm run dist`)                                                                |
| `CERTIFICATE_OSX_APPLICATION`, `CERTIFICATE_PASSWORD`      | Base64 `.p12` Developer ID Application certificate + password, imported into the build keychain by `.github/add_cert_in_keychain.sh` |
| `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`        | Uploading sourcemaps to Sentry during the build (skipped when unset)                                                                 |

### Non-secret config — public values, set per build

| Variable                                                                      | What it is / where it's used                                                                                                                                                                                         |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VITE_FIREBASE_API_KEY` / `VITE_FIREBASE_PROJECT_ID` / `VITE_FIREBASE_APP_ID` | Firebase Remote Config client identifiers (public, not secrets). Empty = Remote Config disabled and the app has no chain catalog — see section 3.                                                                    |
| `VITE_ENVIRONMENTS`                                                           | JSON catalog of environment channels (see `.env.example` for the schema).                                                                                                                                            |
| `VITE_WEBRTC_TURN_HOST`, `VITE_WEBRTC_TURN_TTL`                               | Your TURN relay host and credential TTL for device-sync.                                                                                                                                                             |
| `BUILD_TYPE`                                                                  | Which identity set a build takes: `production` uses `APP_ID` / `PRODUCT_NAME` / `APP_NAME`, anything else prefers their `_DEVELOP` variants. Must be identical for the build and the packaging step — see section 4. |
| `ENABLE_AUTO_UPDATE`                                                          | Must be exactly `true` for the in-app updater to run. Set only by the release pipeline, so local, PR and e2e builds honestly report that they cannot self-update.                                                    |
| `UPDATE_REPO_OWNER`, `UPDATE_REPO_NAME`                                       | GitHub repository the updater reads releases from. Both default to `paritytech/polkadot-desktop-community`; override to point a build at a different repository.                                                     |
| `AUTO_UPDATE_URL`                                                             | Base URL of a static update feed, without the channel suffix. Set only where installed clients read object storage rather than GitHub Releases; it takes precedence over `UPDATE_REPO_*` — see section 7.            |
| `APP_ID`, `PRODUCT_NAME`, `APP_NAME`                                          | The identity a packaged build ships under. No default — packaging fails without all three. See section 4.                                                                                                            |
| `APP_ID_DEVELOP`, `PRODUCT_NAME_DEVELOP`, `APP_NAME_DEVELOP`                  | Optional second identity for non-production builds, making develop a separate application. See section 4.                                                                                                            |
| `LOGGER`                                                                      | Any non-empty value enables verbose logging in all three targets.                                                                                                                                                    |
| `RENDERER_SOURCE`                                                             | `localhost` (dev server) or `filesystem` (built assets); build scripts set it for you.                                                                                                                               |

---

## 3. Firebase setup

All remotely-served configuration comes from Firebase **Remote Config**: the
`chains_v2` network catalog, `dot_ns_config` (dotNS contract addresses),
`ipfs_gateway_url`, and `identity_backend_url`. There are no committed
defaults — **without a configured Firebase project the app has no chain catalog
and bootstrap fails** (`[network] Remote Config "chains_v2" unavailable`), so
Remote Config is effectively required for any real deployment.

1. Create a Firebase project and a web app in it; copy the client identifiers
   into the `VITE_FIREBASE_*` variables.
2. Create the Remote Config parameters (§3.1). Per-channel values are served
   with Remote Config conditions: the app selects a channel by setting the
   `environment` custom signal, and the matching `Common <id> - signal`
   condition serves that channel's values.
3. Describe your channels in the `VITE_ENVIRONMENTS` catalog (§3.2) — its
   `roles` reference `chains_v2` entry ids, so keep the two in sync.

### 3.1 Remote Config parameters

The app ships no bundled defaults: every parameter below has to exist in your
Firebase project, and an unset one reads back as `null`. JSON values are stored
as Remote Config strings. Each read is validated by a Valibot schema — the
schema file, not this table, is the authoritative shape.

| Key                    | Type          | Needed for                            | Read by / schema                                                                                        | Description                                                                                                                                                                                                                                                                                        |
| ---------------------- | ------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `chains_v2`            | JSON array    | app start-up (**required**)           | `src/domains/network/chain/resource.ts`, `remoteChainsSchema` in `src/domains/network/chain/schemas.ts` | The chain catalog. Entry fields below; entry `chainId` labels are what `VITE_ENVIRONMENTS` roles reference.                                                                                                                                                                                        |
| `dot_ns_config`        | JSON object   | resolving apps by name (**required**) | environment assembly, `dotNsConfigSchema` in `src/domains/application/environment/schemas.ts`           | `{ "resolverContractAddress": "…", "registryContractAddress": "…" }` — 20-byte hex contract addresses of the dotNS deployment (`0x` prefix optional).                                                                                                                                              |
| `identity_backend_url` | string (URL)  | contact search (**required**)         | environment assembly, `remoteUrlSchema`                                                                 | Base URL of your deployment of [device-uniqueness-backend-community](https://github.com/paritytech/device-uniqueness-backend-community) — username search and the proof-of-compute puzzle.                                                                                                         |
| `ipfs_gateway_url`     | string (URL)  | loading app bundles (**required**)    | environment assembly, `remoteUrlSchema`                                                                 | IPFS gateway the app fetches product bundles through when content is not on the Bulletin Chain.                                                                                                                                                                                                    |
| `w3s_gate_mode`        | string (enum) | start-up gate (optional)              | `src/bootstrap.ts`, `web3SummitGateModeSchema`                                                          | One of `VERIFICATION_DISABLED` / `VERIFICATION_ENABLED` / `VERIFICATION_ENABLED_SKIPPABLE` / `W3S_ENDED`. **Unset falls back to `VERIFICATION_ENABLED`**; `W3S_ENDED` short-circuits boot to the "event ended" screen — set `VERIFICATION_DISABLED` for a deployment without the Web3 Summit flow. |

A `chains_v2` entry (`remoteChainSchema` is a loose object — extra fields pass
through unvalidated):

```jsonc
{
  "chainId": "alpha-people", // label (what VITE_ENVIRONMENTS roles point at) or a bare genesis hash
  "genesisHash": "1234…abcd", // hex WITHOUT 0x; may be empty when chainId carries the hash
  "name": "Alpha People Chain",
  "addressPrefix": 0,
  "nodes": [{ "url": "wss://rpc.example.com", "name": "Example node" }],
  "assets": [{ "assetId": 0, "symbol": "DOT", "precision": 10 }], // + optional name/priceId/type/typeExtras/icon
  "parentId": null, // optional; relay the chain is a parachain of
  "options": [], // optional feature flags
  "externalApi": { "hop": [] }, // optional; bulletin HOP relay multiaddrs
}
```

### 3.2 The `VITE_ENVIRONMENTS` catalog

Build-time JSON (`rawEnvironmentsConfigSchema` in
`src/domains/application/environment/schemas.ts`) describing every
environment-specific value Remote Config does **not** serve, so no channel
names live in code:

```jsonc
{
  "default": "alpha", // channel selected when none is persisted; must be a key of `channels`
  "shared": {
    // defaults every channel inherits; a channel may override any of them
    "hostChatNetwork": "example-net", // network id the host-chat SDK's createAccountService accepts
    "iosBundleId": "com.example.app", // pairing deeplink target
    "digitalDollarAsset": { "assetId": 1, "symbol": "tUSD", "precision": 6, "palletName": "Assets" },
  },
  "channels": {
    "alpha": {
      "name": "Alpha Testnet", // display label in the environment picker
      // chains_v2 entry labels (chainId) for each chain role
      "roles": { "people": "alpha-people", "bulletin": "alpha-bulletin", "assetHub": "alpha-asset-hub" },
    },
  },
}
```

`digitalDollarAsset` is the token coinage payments are denominated in; its
`symbol` is what transfer amounts in chat are labelled with.

---

## 4. Build environments

The identity a packaged build ships under is configuration, and this repository carries no default
for it. Three variables define it:

| Variable       | Is                                                                               |
| -------------- | -------------------------------------------------------------------------------- |
| `APP_ID`       | the bundle id — what macOS, Windows and Linux match an update against            |
| `PRODUCT_NAME` | the display name: `.app` bundle, NSIS shortcut, window title, `StartupWMClass`   |
| `APP_NAME`     | the packaged `name`, which is what Electron derives the user-data directory from |

**Packaging fails if any of them is unset.** There is no fallback on purpose: a guessed bundle id
does not produce an error, it produces an application that installs _beside_ the one it was meant
to replace, under an empty profile, and nobody notices until an installed client stops updating.
`assertPackagingIdentity()` in `config/index.js` refuses the `npm run dist` instead, and the
`config-check` job in the release pipeline repeats the check up front so the failure does not arrive
at the end of a signed build.

Building bundles is deliberately left alone — `npm start`, `npm run build:dev` and the e2e suite
work with nothing configured, which is what lets a fork's pull request build and test without any
repository variables. Those builds take a display name derived from the package name; it is a
placeholder, and packaging will not accept it.

A fourth variable, `APP_AUTHOR`, names who the build is copyrighted to and who Linux records as the
package maintainer. It behaves differently on purpose: it **keeps a default** — the `author` in
`package.json` — and packaging does not fail without it. The no-default rule above buys protection
against an update chain that breaks silently, and a copyright line cannot break anything it is wrong
about, so requiring it would cost a fork a failed build and buy nothing. There is no
`APP_AUTHOR_DEVELOP` either, since authorship does not differ between a develop and a release build.

### One identity or two

`BUILD_TYPE` chooses between two sets. `production` takes the three variables above; anything else
prefers `APP_ID_DEVELOP` / `PRODUCT_NAME_DEVELOP` / `APP_NAME_DEVELOP` and falls back to them when
they are unset.

Configure the `_DEVELOP` set and develop becomes a separate application: its own install slot,
signing identity and — through the packaged `name` — its own profile, so a develop build never
overwrites a release one or reads its accounts. Leave it unset and every build type ships one
identity, which is what a deployment with existing installs needs, since those installs already
carry a single one.

`BUILD_TYPE` must be identical for the build and the packaging step, or the bundles and the
installer disagree about which application they are.

Both identities register the `polkadot:` scheme, so with both installed the last one wins deep
links.

| Command                 | `NODE_ENV`    | Notes                                       |
| ----------------------- | ------------- | ------------------------------------------- |
| `npm run build`         | `production`  | release-grade renderer/main/preload         |
| `npm run build:staging` | `staging`     | staging renderer mode                       |
| `npm run build:dev`     | `development` | dev/test affordances, used by the e2e suite |

Identity resolution, the protocol scheme (`polkadot:`) and window defaults live in
`config/index.js`; packaging configuration in `electron-builder.js`. A fork sets `APP_ID` to its own
reverse-DNS identifier — there is nothing to change in the source.

---

## 5. Code signing & notarization

### macOS

You need an Apple Developer account and a **Developer ID Application**
certificate.

1. Export the certificate as `.p12`, base64-encode it, and provide it to CI as
   `CERTIFICATE_OSX_APPLICATION` (+ `CERTIFICATE_PASSWORD`).
2. `.github/add_cert_in_keychain.sh` imports it into a dedicated build keychain.
3. `electron-builder` signs with hardened runtime and the entitlements from
   `main/resources/entitlements/entitlements.mac.plist`, then notarizes
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
(`latest*.yml`).

---

## 7. Auto-update hosting

Updates are served straight from **GitHub Releases** — there is no separate
update server to operate. electron-updater's `github` provider reads the
repository's release feed, and because the repository is public it needs no
token in the client.

- Build with `ENABLE_AUTO_UPDATE=true`, otherwise the in-app updater stays
  disabled (`main/factories/updater.ts`). `UPDATE_REPO_OWNER` /
  `UPDATE_REPO_NAME` select the repository and already carry a default.
- **The `latest*.yml` metadata must be attached as release assets** alongside
  the installers. The provider fetches `latest.yml` / `latest-mac.yml` /
  `latest-linux.yml` / `latest-linux-arm64.yml` from the release before it can
  resolve anything; without them auto-update cannot work.
- **Artifact names must not contain spaces.** GitHub rewrites a space in an
  asset name to `.`, electron-updater rewrites it to `-` when building the
  download URL, and the two never meet. `artifactName` in `electron-builder.js`
  uses `${name}`, not `${productName}`, for exactly this reason.
- The two in-app channels map onto GitHub's own release flags:

  | Channel        | `autoUpdater.allowPrerelease` | Resolves to                                       |
  | -------------- | ----------------------------- | ------------------------------------------------- |
  | `stable`       | `false`                       | the release marked **Latest**                     |
  | `experimental` | `true`                        | the newest release in the feed, prerelease or not |

  The release pipeline publishes every release as a prerelease;
  `promote-to-stable.yml` clears the flag and marks it Latest, which is what
  moves a build onto the stable channel.

### Serving updates from object storage instead

Setting `AUTO_UPDATE_URL` switches the build to electron-updater's `generic` provider. Two
deployments need this: one whose clients were installed against a static feed and cannot be
repointed, and one whose releases live in a **private** repository, where the `github` provider
would need a token the installed app has no safe way to hold.

There a channel is a directory rather than a release flag — the runtime appends `stable/` or
`latest/` to the URL — and Linux arm64 keeps its own `latest-linux-arm64.yml`, named explicitly
because the generic provider derives no arch suffix of its own.

`AUTO_UPDATE_URL` configures the build. Publishing is gated separately, on the `UPDATE_S3_BUCKET`
**variable** — a job `if:` cannot read the `secrets` context, so the switch for `mirror-static-feed`
in `release-pipeline.yml` and the promote steps in `promote-to-stable.yml` has to be one. Alongside
it: `UPDATE_S3_ENDPOINT`, `UPDATE_S3_REGION`, and credentials in `SCW_ACCESS_KEY` /
`SCW_SECRET_KEY`.

The two settings are halves of one decision, and either alone fails silently — builds naming a feed
nothing writes to, or a bucket no build reads. The `config-check` job compares them before anything
is built and fails the run if only one is set.

The layout is fixed, because a download page links into it directly:

| Path                   | Holds                                                                                                     |
| ---------------------- | --------------------------------------------------------------------------------------------------------- |
| `releases/<version>/`  | the archive, under the versioned artifact filenames                                                       |
| `latest/`              | the experimental channel, under unversioned names (`Polkadot-Desktop.exe`, `Polkadot-Desktop-x64.dmg`, …) |
| `stable/`              | the stable channel, same unversioned names, written by promote                                            |
| `stable/versions.json` | promoted versions, newest first — read by the download page, not by the updater                           |

So each artifact is republished under a static name rather than copied as-is, and
`scripts/rewrite-update-metadata.js` repoints the `path` / `url` fields inside the `latest*.yml` at
those names (and injects the GitHub release notes) so the updater resolves them as well. That
script's rewrite table matches `Polkadot Desktop-<version>-<arch>.<ext>`, which is also why
`artifactName` keeps `${productName}` on this path while GitHub Releases takes `${name}`.

Promotion renames on the way from `releases/<version>/` to `stable/`; the metadata needs no second
rewrite, having been written with the static names already.

---

## 8. The release pipeline

`.github/workflows/release-pipeline.yml` is the working reference: triggered on a
`v*` tag (or manual dispatch), it builds every OS/arch via the
`.github/actions/build-app` composite action, runs the e2e suite, and creates a
GitHub Release carrying both the installers and the update metadata. A fork can
reuse its shape:

1. Check out the repo, `npm ci`.
2. Export the build variables (section 2) from your secret store.
3. Import the macOS signing certificate into a keychain
   (`.github/add_cert_in_keychain.sh`).
4. `npm run prod:sequence` per OS/arch.
5. Create a GitHub Release from the tag and attach the installers **and** the
   `latest*.yml` files from `release/dist/`.
6. Promote a release to the stable channel with `promote-to-stable.yml`, which
   marks it Latest and clears its prerelease flag.

Keep every credential in your CI provider's secret store — never commit
`.env.local`, certificates, service-account JSON, or API keys.
