#!/usr/bin/env bash
# PreToolUse hook for Edit|Write|MultiEdit.
# Hard-blocks two classes of edit that violate non-negotiable project policy:
#   1. Creating a NON-CANONICAL .ts/.tsx file under src/domains/** — the file kinds
#      a domain module may contain are a closed set (docs/code/project-structure.md).
#      This is the deterministic guard against invented files like `changes.ts`,
#      `manager.ts`, `helpers.ts`. Only blocks CREATION; edits to existing files pass.
#   2. Writing to generated/protected config that must not be hand-edited in place
#      (.papi/ descriptors are regenerated; eslint.config.js is project-owned).
# Exit 2 denies the tool call with a message Claude sees and must act on.

set -uo pipefail

input="$(cat)"
file_path="$(printf '%s' "$input" | jq -r '
    (.tool_input.file_path
        // .tool_input.notebook_path
        // .tool_input.path
        // empty)')"

[[ -z "$file_path" ]] && exit 0

# Normalize to a repo-relative path when possible.
rel="$file_path"
case "$file_path" in
    "$CLAUDE_PROJECT_DIR"/*) rel="${file_path#"$CLAUDE_PROJECT_DIR"/}" ;;
esac

# ---- Guard 2: generated / protected config ----------------------------------
case "$rel" in
    .papi/*|*/.papi/*)
        cat <<'EOF' >&2
⛔ Blocked by project policy.

You're editing generated output under .papi/. These descriptors are produced by
`npm run papi:generate` / `npm run papi:update` and must never be hand-edited —
your change will be overwritten on the next generate. Update the source metadata
and regenerate instead. If you truly need a manual change, escalate to the user.
EOF
        exit 2
        ;;
    eslint.config.js)
        cat <<'EOF' >&2
⛔ Blocked by project policy.

eslint.config.js is project-owned lint configuration. Don't edit it in place as a
side effect of feature work — silencing or re-scoping a rule changes the contract
for the whole repo. If a rule genuinely needs changing, escalate to the user with
the rationale instead of editing it directly.
EOF
        exit 2
        ;;
esac

# ---- Guard 1: canonical filenames under src/domains/ ------------------------
# Only applies to new .ts/.tsx files being CREATED under a domain.
case "$rel" in
    src/domains/*) ;;            # in scope
    *) exit 0 ;;                 # other layers: not this guard's concern
esac

case "$file_path" in
    *.ts|*.tsx) ;;               # only code files
    *) exit 0 ;;
esac

# Editing an existing file is always allowed (legacy / already-vetted names).
[[ -f "$file_path" ]] && exit 0

base="$(basename "$file_path")"

# Allow-through: contexts where arbitrary names are legitimate.
case "$rel" in
    */\$usecase/*) exit 0 ;;     # $usecase/{group}.ts — verb-named, open set
    */mocks/*) exit 0 ;;         # test fixtures are exempt (style.md)
esac
case "$base" in
    *.spec.ts|*.test.ts|*.test.tsx) exit 0 ;;   # co-located tests
    *.hooks.ts) exit 0 ;;                        # {group}.hooks.ts in $usecase
esac

# Canonical leaf/container/root file kinds (docs/code/project-structure.md).
case "$base" in
    index.ts|types.ts|service.ts|resource.ts|hooks.ts|gateway.ts|repository.ts|schemas.ts|constants.ts|bootstrap.ts)
        exit 0 ;;
esac

cat >&2 <<EOF
⛔ Blocked by project policy: non-canonical file under src/domains/.

  $rel

A domain module may ONLY contain these file kinds
(docs/code/project-structure.md § File contracts):

  index · types · service · resource · hooks · gateway ·
  repository · schemas · constants · bootstrap · README
  (+ \$usecase/{group}.ts and {group}.hooks.ts for orchestration,
   + *.spec.ts / *.test.tsx co-located tests, + mocks/)

You're about to invent "$base", which is none of these. This is the exact
failure mode the project guards against. Do ONE of:

  • Put the logic in the canonical file that owns it (a predicate → service.ts,
    a cached read → resource.ts, persistence → repository.ts, wire I/O →
    gateway.ts, cross-source orchestration → \$usecase/{group}.ts).
  • If it's genuinely cross-source orchestration, create it under \$usecase/.
  • If nothing fits, STOP and ask the user — do not rename to dodge this guard.

Run the 'architecture' skill if you haven't placed this change yet.
EOF
exit 2
