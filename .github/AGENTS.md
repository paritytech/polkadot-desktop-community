# CI/CD agent guide

This file is the entry point for any agent working on CI, packaging, releases,
distribution, update feeds, or CI test reporting in this repository. It applies
to everything under `.github/`.

Read this file first, then open the executable source linked from the relevant
section. Workflow YAML and scripts are the source of truth. Documentation such
as [`../docs/PUBLISHING.md`](../docs/PUBLISHING.md) explains intended usage but
may lag behind executable code.

## System overview

The repository uses GitHub Actions for CI and CD. There are four main paths:

1. Pull-request CI runs code-quality checks, unit tests, E2E tests, and maintains
   the Nix dependency hash.
2. A manual PR-build workflow produces installable artifacts from a selected PR
   without creating a release.
3. The release pipeline builds installable Electron artifacts. A manual branch
   run stops at workflow artifacts; tag publication additionally creates a
   GitHub Release and may mirror it to S3-compatible object storage.
4. A separate manual promotion marks an existing GitHub Release as Latest and,
   for static-feed deployments, copies its archived artifacts into `stable/`.

The important flow is:

```text
weekday/manual tag creation
  -> v* tag
  -> release pipeline with PUBLISH_RELEASE=true
       -> unit/type checks
       -> signed/package builds for macOS, Linux x64/arm64, Windows
       -> separate dev build and release E2E matrix
       -> GitHub Release (not marked Latest)
       -> optional static-feed mirror:
            S3 /releases/<version>/ and experimental /latest/
  -> manual Promote to Stable
       -> mark GitHub Release as Latest
       -> optional copy /releases/<version>/ to /stable/ under generic names

manual Release Pipeline from a selected branch
  -> workflow definition and application source from that branch
  -> the same checks, packaged builds, signing/notarization, and E2E jobs
  -> workflow artifacts only; no Release, S3 upload, or Telegram message
```

For a static-feed deployment, do not equate the S3 `/latest/` directory with the
stable channel. In the runtime updater, `/latest/` is the **experimental**
channel and `/stable/` is the default **stable** channel. A GitHub-Releases
deployment represents the same choice with prerelease/Latest flags instead of
directories. See
[`../main/factories/updater.ts`](../main/factories/updater.ts) and
[`../main/shared/update-channel.ts`](../main/shared/update-channel.ts).

## Workflow inventory

### Pull-request CI

- [`workflows/lint.yaml`](workflows/lint.yaml) runs on every pull request. It
  installs with `npm ci`, then runs TypeScript checking, Prettier checking, and
  ESLint through the scripts in [`../package.json`](../package.json).
- [`workflows/tests_unit.yaml`](workflows/tests_unit.yaml) runs `npm test` on
  pull requests and publishes the JUnit files from `node_modules/.tmp/` as a
  GitHub check/PR comment. `npm test` currently runs the renderer, Electron main,
  and E2E-helper Vitest projects; see
  [`../vitest.config.ts`](../vitest.config.ts),
  [`../vitest.main.config.ts`](../vitest.main.config.ts), and
  [`../vitest.e2e.config.ts`](../vitest.e2e.config.ts).
- [`workflows/tests_e2e.yml`](workflows/tests_e2e.yml) runs on pull requests and
  by manual dispatch. It builds one unpackaged dev-mode JS bundle on Linux and
  reuses that bundle across test shards.
  - With repository secrets, functional projects `smoke`, `auth`,
    `authenticated`, `product-sdk`, `chat`, `link-navigation`, and `browser`
    currently run on Linux only. Fork PRs run only `smoke`, `link-navigation`,
    and `browser`; the four signer-backed projects are omitted from their matrix,
    because the identity cache they need holds plaintext mnemonics and a fork
    pull request can read base-branch caches.
  - The `security` project runs on Linux, macOS, and Windows.
  - Allure TestOps is optional. Without all three TestOps values, tests run
    directly under Playwright while still producing local Allure and JUnit
    artifacts for the static reports.
  - The report job attempts to render the GitHub Step Summary, merges Allure
    shards, and creates multi-file and single-file Allure reports. On PR events
    it also uploads per-test failure media and upserts a sticky comment.
  - Project definitions, worker counts, retries, reporters, screenshots, video,
    and traces live in [`../playwright.config.ts`](../playwright.config.ts).
- [`workflows/autoupdate-nix-hash.yml`](workflows/autoupdate-nix-hash.yml) runs on
  pull requests with `contents: write`. It computes the fixed-output npm hash
  through [`../scripts/update-nix-deps.js`](../scripts/update-nix-deps.js) and
  commits an updated [`../flake.nix`](../flake.nix) directly to the PR head
  branch when needed.
- [`workflows/build-pr.yml`](workflows/build-pr.yml) is manual only. It resolves
  a PR head SHA, constructs a version such as `0.1.0-pr123.abcdef0`, optionally
  builds selected platforms, uploads installable workflow artifacts, and
  upserts a download comment on the PR. It never creates a GitHub Release and
  never uploads to S3. Its macOS build uses the `parity-macos` runner; the normal
  release build uses `macos-latest`. The selected PR code executes with
  repository secrets, so the operator must review and trust the selected PR.

### Main-branch and scheduled maintenance

- [`workflows/check-nix-hash.yml`](workflows/check-nix-hash.yml) runs on pushes
  to `main`. It reports an error only when Nix reports an `npmDepsHash` mismatch.
  The current shell deliberately tolerates the initial `nix build` exit status
  and does not turn unrelated Nix failures into a failed workflow.
### Tag creation

[`workflows/create-release-tag.yml`](workflows/create-release-tag.yml) runs at
`16:00 UTC` on weekdays and by manual dispatch.

- A scheduled run checks whether `main` has commits after the most recent tag.
  With no changes it sends a Telegram skip notification and does not tag.
- Automatic tags patch-bump the latest tag using
  [`bump_release_version.sh`](bump_release_version.sh).
- Manual runs may supply an exact `vX.Y.Z...` tag and select `dev` or
  `production` build type.
- After pushing the tag, this workflow explicitly dispatches
  `release-pipeline.yml` at that tag with `PUBLISH_RELEASE=true`. This explicit
  dispatch is required for tags pushed with the workflow's `GITHUB_TOKEN`,
  because those pushes do not normally trigger another workflow run.
- Scheduled releases currently use `build_type=dev`.

### Release pipeline

[`workflows/release-pipeline.yml`](workflows/release-pipeline.yml) runs for a
`v*` tag push and by manual dispatch. Its concurrency group is the repository-
wide `gh-release`, with cancellation disabled, so all runs serialize. In the
manual **Run workflow** form, the selected ref determines both the workflow
definition and application source. Selecting a branch therefore tests changes
to the workflow itself as well as changes to the product code.

Manual dispatch defaults to `PUBLISH_RELEASE=false`. In that mode the full
build, signing/notarization, unit-test, and E2E paths run and upload workflow
artifacts, while auto-update is disabled and all GitHub Release, static-feed,
and Telegram jobs are skipped. `PUBLISH_RELEASE=true` is accepted only when the
selected ref is a `v*` tag. A tag push publishes automatically.

The jobs currently behave as follows:

- `validate-mode` rejects a manual publication attempt whose selected ref is
  not a `v*` tag. Every build/test path waits for this check.
- `config-check` requires the configured application identity and enforces that
  `AUTO_UPDATE_URL` and `UPDATE_S3_BUCKET` are either both configured or both
  absent. The build matrix waits for it.
- `unit-tests` runs TypeScript checking and `npm test`. It does not run the
  standalone lint or Prettier workflows.
- `build` is a four-entry matrix:
  - `macos-latest`: DMG and ZIP, both x64 and arm64; packaged macOS builds require
    all five Apple inputs and must pass signing/notarization verification;
  - `ubuntu-latest`: x64 AppImage;
  - `ubuntu-24.04-arm`: arm64 AppImage;
  - `windows-latest`: x64 NSIS installer, currently unsigned.
- `e2e-build` produces a separate dev-mode, unpackaged build. Release-grade
  production bundles hide affordances required by the E2E suite, so release E2E
  must not reuse the packaged production build.
- `e2e` runs `smoke`, `auth`, `authenticated`, `product-sdk`, and `chat` across
  Linux, macOS, and Windows. Unlike PR E2E, the release matrix currently omits
  `link-navigation`, `browser`, and `security`.
- `e2e-summary` renders a per-project/per-OS table even when E2E fails.
- `release` runs only in publication mode. It waits for `build` and `unit-tests`,
  downloads and merges the platform artifacts, creates a non-draft GitHub
  Release with generated notes, and attaches installers plus all `latest*.yml`
  metadata. Despite the job name, it does not publish the static feed.
- `mirror-static-feed` waits for `build` and `release` and runs only when
  publication mode is enabled and `UPDATE_S3_BUCKET` is non-empty. It validates
  the remaining S3 configuration, rewrites metadata to static artifact names,
  archives the version under `/releases/<version>/`, and publishes the
  experimental `/latest/` directory.
- `tests-report` runs only in publication mode, waits for `build`, `release`, and
  `e2e`, exports an Allure TestOps PDF, and sends it through Telegram.
- `release-notify` runs only in publication mode and sends the release/download
  notification after `release`.
- `telegram-notify-failure` currently depends on `build`, `unit-tests`, and
  `release`, and runs only in publication mode; E2E is intentionally absent from
  its `needs` list in the current file.

Important publication-mode behavior: the `release` and `mirror-static-feed`
jobs do **not** depend on `e2e`.
Installers can therefore be released to GitHub and `/latest/` after build and
unit tests pass while E2E is still running or even if E2E later fails. Treat a
change that makes E2E a release gate as a behavior change, not a refactor.
`release-notify` also waits only for `build` and `release`, and the failure
notification does not list `mirror-static-feed`; a static-feed mirror failure
can therefore coexist with a successful release notification and no dedicated
failure Telegram message.

The GitHub Release is always created with `make_latest: false`. In a
GitHub-Releases deployment (`UPDATE_S3_BUCKET` empty), it is also created as a
prerelease so the experimental channel can see it before promotion. In a static-
feed deployment it is created with `prerelease: false`; channel selection lives
in S3 instead. The `(dev)` suffix affects only the display name. The separate
stable-promotion workflow clears the prerelease flag and marks the selected
release Latest in both deployment modes.

### Stable promotion

[`workflows/promote-to-stable.yml`](workflows/promote-to-stable.yml) is manual
only and serializes through `gh-promote-stable`.

It:

1. validates a version without the leading `v`;
2. requires the matching GitHub Release to exist;
3. reads the current stable version from GitHub Latest, or from
   `/stable/latest.yml` when a static feed is configured;
4. refuses an equal version or a downgrade using `sort -V`;
5. for a static-feed deployment, requires archived objects under
   `/releases/<version>/`, copies required/optional binaries and metadata to
   `/stable/` under generic names, and prepends the version to
   `/stable/versions.json`;
6. clears the GitHub prerelease flag and marks `v<version>` as Latest.

The workflow sends a Telegram success or failure notification. Promotion is a
metadata/copy operation over existing artifacts; it does not rebuild the
application.

## Shared actions and build contract

### Node setup

[`actions/setup-node/action.yaml`](actions/setup-node/action.yaml) is the shared
Node bootstrap and enables the npm cache. The project is on Node 24; also see
[`../.nvmrc`](../.nvmrc) and `engines` in
[`../package.json`](../package.json).

### Application build

[`actions/build-app/action.yml`](actions/build-app/action.yml) is the shared
build/package action used by release, PR-build, and E2E workflows. Changes to
build-time inputs should normally be made here first and then propagated to
every caller.

Its contract is:

- run `npm ci`;
- optionally apply a package version with `npm version --no-git-tag-version`;
- require all Sentry values when `sentry_required=true`;
- whenever installable macOS artifacts are requested, require all five Apple
  signing/notarization inputs, import the base64 `.p12` through
  [`add_cert_in_keychain.sh`](add_cert_in_keychain.sh), and fail if it does not
  yield a `Developer ID Application` identity;
- for `build_type=production`, build main/preload/call-window-preload/renderer in
  production mode and allow hidden sourcemap upload to Sentry;
- for `build_type=dev`, build development bundles with a filesystem renderer
  and without Sentry sourcemaps;
- optionally run Electron Builder and upload installable artifacts;
- after macOS packaging, verify every `.app` with `codesign`, require the
  configured Team ID, validate the stapled ticket, and run Gatekeeper assessment;
- upload `release/build` for E2E reuse; and
- restore the runner's original keychain search/default state and remove the
  temporary build keychain through
  [`remove_cert_keychain.sh`](remove_cert_keychain.sh), including after failure.

`add_cert_in_keychain.sh` is Bash with fail-fast enabled. Secret values must stay
quoted; unquoted `.p12` passwords are subject to field splitting and pathname
expansion. The script writes the decoded container only under `RUNNER_TEMP`,
uses a per-run keychain with a generated password, and removes the temporary
`.p12` on exit. This isolation is especially important on `parity-macos`, which
is not an ephemeral hosted runner.

There is no staging build type in the CI action. Staging commands exist in
[`../package.json`](../package.json) but the current workflow inputs expose only
`dev` and `production`.

Build-time configuration is threaded from GitHub secrets/variables through the
composite action into the Vite configurations:

- [`../vite.config.main.ts`](../vite.config.main.ts) embeds the version, product
  name, updater gate/feed URL, renderer source, logger flag, and Sentry DSN;
- [`../vite.config.renderer.ts`](../vite.config.renderer.ts) embeds build mode,
  version/build time, logger/Sentry values and loads `VITE_*` values;
- [`../vite.config.preload.ts`](../vite.config.preload.ts) and
  [`../vite.config.call-window-preload.ts`](../vite.config.call-window-preload.ts)
  produce the two CommonJS preload bundles;
- [`../scripts/postbuild.js`](../scripts/postbuild.js) writes the stripped
  `release/build/package.json` used for packaging.

`VITE_ENVIRONMENTS` plus the three Firebase client identifiers are required by
real CI builds. TURN configuration is also passed by the current workflows.
Release builds require the Sentry inputs; PR installable builds pass them but do
not make them mandatory. Every packaged macOS CI build requires the Apple
inputs, regardless of `build_type`.

### Packaging and artifact names

[`../electron-builder.js`](../electron-builder.js) is the source of truth for
targets, signing/notarization settings, update metadata generation, and artifact
names. Artifact naming depends on the update provider:

```text
GitHub Releases: ${name}-${version}-${arch}.${ext}
static feed:     ${productName}-${version}-${arch}.${ext}
```

The GitHub provider uses package `name` (`polkadot-desktop`) because spaces in a
GitHub release asset are rewritten differently by GitHub and electron-updater.
The static-feed publishing scripts depend on the historical `productName`
(`Polkadot Desktop`) filenames. Those contain spaces, so every static-feed shell
path that mentions a packaged file must remain quoted.

When Linux is built separately per architecture, the build action copies
Electron Builder's `latest-linux.yml` to `latest-linux-x64.yml` or
`latest-linux-arm64.yml`. The release job later restores `latest-linux.yml` from
x64 for backward compatibility.

### Update metadata and S3 layout

[`../scripts/rewrite-update-metadata.js`](../scripts/rewrite-update-metadata.js)
rewrites Electron Builder's versioned artifact paths to generic static names and
injects GitHub release notes when token/repository/version are available.

The optional `mirror-static-feed` job publishes two layouts, and stable
promotion writes the third:

```text
/releases/<version>/
  complete versioned artifacts and rewritten latest*.yml files

/latest/
  generic experimental-channel artifact names and latest*.yml files

/stable/
  generic stable-channel artifacts and metadata, written only by promotion
```

`/latest/` and `/stable/` receive short `Cache-Control` values. The Scaleway
credentials are repository secrets; endpoint, region, and bucket are repository
variables. `UPDATE_S3_BUCKET` is the job-level switch for both mirroring and
static-feed promotion. `config-check` requires it to agree with the presence of
the `AUTO_UPDATE_URL` secret before building.

Auto-update support requires both build-time `ENABLE_AUTO_UPDATE=true` and a
configured feed. The feed is either a non-empty `AUTO_UPDATE_URL` for the generic
provider or the `UPDATE_REPO_OWNER`/`UPDATE_REPO_NAME` GitHub repository pair;
see
[`../main/shared/auto-update.ts`](../main/shared/auto-update.ts). The release
pipeline is the workflow that supplies the explicit enable flag. PR and E2E
builds leave it disabled unless their caller is deliberately changed.

For GitHub Releases, `stable` resolves the release marked Latest and
`experimental` enables prereleases. For a static feed, the runtime appends
`stable/` or `latest/` to `AUTO_UPDATE_URL`. Keep provider-specific artifact
naming, metadata rewriting, release flags, and directory promotion aligned as
one contract.

## E2E execution and reporting

[`actions/run-e2e-tests/action.yml`](actions/run-e2e-tests/action.yml):

- downloads a named `release/build` artifact;
- caches/installs Playwright browsers and Linux system dependencies;
- downloads the exact Electron zip for the installed npm package into a
  separate cache and installs it manually;
- detects Allure TestOps only when endpoint, token, and project ID are all
  present, then executes the supplied command under `allurectl watch`; otherwise
  it runs the same command directly;
- installs `truapi-host` and restores/saves the signer identity cache only when
  the caller opts in via `signer-backed` / `identity-cache`, both defaulting to
  `false` — the same action also runs the `security` job and the macOS/Windows
  `smoke` rows, which have no `truapi-host` binary available;
- passes the optional `E2E_IDENTITY_URL` at **test runtime** (wired from the
  repository variable of the same name — empty means registrations are not
  confirmed against the registry, never a URL baked into the repository);
- exports Allure launch information only when TestOps is enabled; and
- uploads raw Allure and JUnit shard artifacts even after test failure, with
  one-day retention.

Shard artifact names must keep the existing
`allure-results-<project>-<os>` / `e2e-junit-<project>-<os>` convention. The
report renderer derives project and OS by parsing those directory names.

[`scripts/render-e2e-report.py`](scripts/render-e2e-report.py) implements four
modes:

- `step-summary`: per-project/per-OS GitHub Step Summary;
- `pr-comment`: aggregate sticky PR report with failed/flaky details;
- `merge`: flatten Allure shards and inject missing Platform parameters;
- `failure-media`: collect screenshots/videos for failed and flaky tests.

[`scripts/upload-failure-media.cjs`](scripts/upload-failure-media.cjs) uploads
each manifest entry as a separate 14-day workflow artifact and writes its URL
back into the manifest. The renderer's unit coverage is in
[`scripts/test_render_e2e_report.py`](scripts/test_render_e2e_report.py).

The release-only PDF exporter is
[`actions/allure-export-pdf/action.yml`](actions/allure-export-pdf/action.yml).
It skips when TestOps credentials or a launch ID are absent; otherwise it
requests, polls, and downloads a PDF through the TestOps API.
Static Allure CLI output is configured by
[`../allurerc.mjs`](../allurerc.mjs) and
[`../allurerc.singlefile.mjs`](../allurerc.singlefile.mjs).

## Secrets, variables, permissions, and external services

Never print secret values, write them to committed files, or add them to build
artifacts. Preserve the secret/variable distinction used by current callers.

Current integrations and inputs include:

- Apple signing/notarization: `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`,
  `APPLE_TEAM_ID`, `CERTIFICATE_OSX_APPLICATION`, `CERTIFICATE_PASSWORD`;
- Sentry: `SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`;
- build config: `AUTO_UPDATE_URL`, `VITE_FIREBASE_API_KEY`,
  `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`,
  `VITE_WEBRTC_TURN_HOST`, `VITE_WEBRTC_TURN_SECRET`, and
  `VITE_WEBRTC_TURN_TTL`;
- Allure TestOps: `ALLURE_ENDPOINT`, `ALLURE_PROJECT_ID`, `ALLURE_TOKEN`;
- distribution: `SCW_ACCESS_KEY`, `SCW_SECRET_KEY`;
- notifications: `TELEGRAM_TOKEN`, `TELEGRAM_TO`;
- GitHub API/release operations: workflow-scoped `GITHUB_TOKEN`.

Repository variables consumed by executable workflows are:

- application identity: `APP_ID`, `PRODUCT_NAME`, `APP_NAME`, optional
  `APP_ID_DEVELOP`, `PRODUCT_NAME_DEVELOP`, `APP_NAME_DEVELOP`, and optional
  `APP_AUTHOR`;
- updater/build catalog: `UPDATE_REPO_OWNER`, `UPDATE_REPO_NAME`,
  `VITE_ENVIRONMENTS`;
- optional static feed: `UPDATE_S3_BUCKET`, `UPDATE_S3_ENDPOINT`,
  `UPDATE_S3_REGION`.

`ALLURE_USERNAME` is exposed as a manual input by E2E/release workflows but is
not consumed by current executable steps. Do not assume an input is functional
without tracing its use.

Keep each workflow's `permissions` minimal but sufficient. In particular,
Nix auto-update intentionally writes repository content, unit results write
checks/comments, PR builds write PR comments, and release/promotion write
releases.

External systems that cannot be validated from repository files alone are:

- configured GitHub secrets and variables;
- branch protection and required-check settings;
- availability/configuration of `parity-macos` and hosted runners;
- the configured Allure TestOps instance/project;
- the identity registry (`E2E_IDENTITY_URL`) and the `truapi-host` release the installer resolves;
- Apple Developer membership, certificate validity, and notarization service;
- Scaleway bucket contents, object ACLs, and CDN behavior; and
- Telegram credentials/chat configuration.

State clearly when a conclusion depends on one of these external systems.

## Change checklists

### Changing build-time configuration

Trace and update all of the following as applicable:

1. input declaration and environment mapping in
   [`actions/build-app/action.yml`](actions/build-app/action.yml);
2. every caller in `workflows/`;
3. the relevant `vite.config.*` define/env loading;
4. runtime consumer code;
5. [`../.env.example`](../.env.example) and
   [`../docs/PUBLISHING.md`](../docs/PUBLISHING.md).

Search for both the environment-variable name and its composite-action input
name. They often differ in case and spelling.

### Changing macOS signing or notarization

Keep these paths aligned:

1. input validation and post-package verification in
   [`actions/build-app/action.yml`](actions/build-app/action.yml);
2. import/cleanup behavior in [`add_cert_in_keychain.sh`](add_cert_in_keychain.sh)
   and [`remove_cert_keychain.sh`](remove_cert_keychain.sh);
3. Apple inputs passed by every installable-build caller;
4. the manual non-publishing branch path in
   [`workflows/release-pipeline.yml`](workflows/release-pipeline.yml); and
5. the post-package signature, Team ID, stapling, and Gatekeeper checks.

Do not weaken a failed `security import`, zero signing identities, `codesign`,
Team ID, stapling, or Gatekeeper failure into a warning. Both manual PR builds
and manual release-pipeline branch builds execute selected branch code with
repository secrets. Run them only for reviewed internal code.

### Changing artifact names, formats, platforms, or architectures

Update this set as one contract:

1. [`../electron-builder.js`](../electron-builder.js);
2. build matrices and artifact globs in
   [`workflows/release-pipeline.yml`](workflows/release-pipeline.yml) and
   [`workflows/build-pr.yml`](workflows/build-pr.yml);
3. Linux metadata handling in
   [`actions/build-app/action.yml`](actions/build-app/action.yml);
4. path mappings in
   [`../scripts/rewrite-update-metadata.js`](../scripts/rewrite-update-metadata.js);
5. versioned and static S3 upload paths in the release workflow;
6. required/optional copy paths in
   [`workflows/promote-to-stable.yml`](workflows/promote-to-stable.yml); and
7. runtime metadata/channel selection in
   [`../main/factories/updater.ts`](../main/factories/updater.ts).

An artifact-name change that updates only Electron Builder will break release
uploads or stable promotion.

### Adding or renaming an E2E project

Update:

1. the project and BDD configuration in
   [`../playwright.config.ts`](../playwright.config.ts);
2. the npm script in [`../package.json`](../package.json);
3. the PR and/or release workflow matrices, intentionally deciding which OSes
   should run it;
4. setup/teardown dependencies and bot-user requirements;
5. artifact names consumed by the report renderer; and
6. [`../e2e/README.md`](../e2e/README.md) and `../e2e/CLAUDE.md` when conventions
   or fixture architecture change.

### Changing release gating or channels

Re-read the full job dependency graph in
[`workflows/release-pipeline.yml`](workflows/release-pipeline.yml), not only the
edited job. `release` and `mirror-static-feed` are separate jobs and neither
currently waits for E2E. Explicitly decide whether E2E, lint, formatting,
security, report generation, or static-feed mirroring should block GitHub
Release creation, notifications, or channel publication.

Keep `/latest/` (experimental) and `/stable/` semantics aligned across release,
promotion, metadata rewriting, runtime channel selection, user-facing labels,
and publishing documentation.

### Changing dependencies or Nix packaging

After a lockfile/dependency change, keep `npmDepsHash` in
[`../flake.nix`](../flake.nix) synchronized through
[`../scripts/update-nix-deps.js`](../scripts/update-nix-deps.js). The Nix package
uses system Electron and is separate from Electron Builder's AppImage pipeline.

## Verification

Use the smallest verification set that covers the change, then expand for
release-critical edits.

- Parse every changed workflow and composite action. Run `actionlint` on
  workflows; it understands GitHub expressions but does not treat composite
  `action.yml` metadata as a workflow. Use a YAML parser for composite metadata
  and `shellcheck` for standalone or embedded shell.
- After changing certificate import/cleanup, test with a mocked `security`
  command and a password containing whitespace and glob characters. Assert both
  byte-for-byte argument preservation and non-zero propagation from a failed
  import.
- The real Apple integration can only be covered on macOS. Before merge, run a
  manual `Release Pipeline` from the branch containing the workflow change,
  choose `BUILD_TYPE=production`, and leave `PUBLISH_RELEASE=false`. This
  creates an Apple notarization submission and workflow artifacts, but no
  GitHub Release, S3 objects, PR comment, or Telegram message. The notarization
  submission is still an external mutation requiring authorization.
- Run the report-renderer tests after changing E2E reporting:

  ```bash
  python3 -m unittest discover .github/scripts -p 'test_*.py' -v
  ```

- Run relevant unit/type/lint commands from [`../package.json`](../package.json)
  after changing build scripts or TypeScript runtime gates.
- For metadata changes, test against representative Windows, macOS x64/arm64,
  and Linux x64/arm64 `latest*.yml` samples.
- Verify all matrix artifact names remain unique before `merge-multiple: true`.
- Do not create tags, GitHub Releases, S3 objects, PR comments, or Telegram
  messages merely to validate a local change. Those are external mutations and
  require the task to authorize them.

The root [`../docker-compose.yml`](../docker-compose.yml) is not referenced by
any current GitHub Actions workflow and points to a `docker/Dockerfile` that is
not present in this repository. Do not treat it as part of the active CI/CD path
without first establishing a new intended deployment flow.
